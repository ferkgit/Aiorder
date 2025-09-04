// src/mpClient.ts
type MPError = Error & { status?: number; name?: string; reset_time?: string };

const sleep = (ms:number) => new Promise(res => setTimeout(res, ms));

async function mpGetJson(path: string) {
  const base = (process.env.MP_BASE_URL || "").replace(/\/+$/,"");
  const url = `${base}/api${path}`; // primer: https://.../api/orders?...
  const r = await fetch(url, {
    headers: {
      "X-Api-Key": process.env.MP_KEY || "",
      "X-Api-Secret": process.env.MP_SECRET || "",
      "Accept": "application/json"
    }
  });
  const text = await r.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}

  if (!r.ok) {
    const err: MPError = new Error(`[GET ${path}] ${r.status} ${text || ""}`);
    err.status = r.status;
    err.name = json?.error?.name;
    err.reset_time = json?.error?.details?.reset_time;
    throw err;
  }
  return json;
}

// Paginacija ZAUSTAVLJA kada: (1) poslednja strana < limit, (2) dostignut max, (3) 404 records_not_found
export async function fetchAllOrders(max = Infinity) {
  const limit = 100;
  let start = 0;
  const out: any[] = [];

  for (;;) {
    const path = `/orders?start=${start}&limit=${limit}`;
    try {
      const page = await mpGetJson(path);            // očekujemo niz
      if (!Array.isArray(page) || page.length === 0) break;

      out.push(...page);
      if (out.length >= max) break;                  // poštuj maxOrders
      if (page.length < limit) break;                // poslednja, nepotpuna strana => kraj
      start += limit;
    } catch (e: any) {
      if (e?.status === 404 && (e?.name === "records_not_found" || /records_not_found/i.test(e?.message || ""))) {
        break;                                       // tretiraj kao kraj paginacije
      }
      if (e?.status === 429) {                       // Too Many Requests: sačekaj do reset_time
        const waitMs = e?.reset_time ? Math.max(0, Date.parse(e.reset_time) - Date.now()) : 1200;
        await sleep(waitMs);
        continue;
      }
      throw e;                                       // ostalo propagiraj
    }
  }

  return out.slice(0, max);
}

export async function fetchAllProducts(max = Infinity) {
  const limit = 100;
  let start = 0;
  const out: any[] = [];

  for (;;) {
    const path = `/products?include=variants&start=${start}&limit=${limit}`;
    try {
      const page = await mpGetJson(path);
      if (!Array.isArray(page) || page.length === 0) break;

      out.push(...page);
      if (out.length >= max) break;
      if (page.length < limit) break;
      start += limit;
    } catch (e: any) {
      if (e?.status
