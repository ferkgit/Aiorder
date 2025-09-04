// Jednostavan globalni limiter + retry sa poštovanjem 429 reset_time / Retry-After
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

type LimiterOpts = { rps: number; burst?: number; };
export function makeLimiter({ rps, burst = 1 }: LimiterOpts) {
  const interval = Math.ceil(1000 / rps);
  let queue: (() => void)[] = [];
  let tokens = burst;
  setInterval(() => {
    tokens = Math.min(tokens + 1, burst);
    if (tokens > 0 && queue.length) {
      tokens--;
      const fn = queue.shift()!;
      fn();
    }
  }, interval);

  async function schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => task().then(resolve).catch(reject);
      if (tokens > 0) { tokens--; run(); } else { queue.push(run); }
    });
  }
  return { schedule };
}

export type RetryOpts = { max: number; baseMs?: number; };
export async function withRetry<T>(fn: () => Promise<T>, { max, baseMs = 500 }: RetryOpts): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const resp: AxiosResponse | undefined = err?.response;
      // 429: poštuj reset_time / Retry-After ako postoji
      if (resp?.status === 429) {
        const retryAfter = Number(resp.headers?.["retry-after"]);
        let waitMs = !Number.isNaN(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseMs * Math.pow(2, attempt);
        // MerchantPro često vraća reset_time u body-ju
        const rt = resp.data?.error?.details?.reset_time;
        if (rt) {
          const t = new Date(rt).getTime() - Date.now();
          if (t > 0 && t < 60_000) waitMs = t + 200; // malo buffer-a
        }
        await sleep(waitMs);
      } else if (resp && resp.status >= 500 && resp.status < 600) {
        // 5xx: exponential backoff
        await sleep(baseMs * Math.pow(2, attempt));
      } else {
        throw err;
      }
      if (attempt > max) throw err;
    }
  }
}
