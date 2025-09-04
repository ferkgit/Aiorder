import axios from "axios";
import { Buffer } from "buffer";
import { cfg } from "./config";
import { makeLimiter, withRetry } from "./rate";

const limiter = makeLimiter({ rps: 2, burst: 1 }); // konzervativno da izbegnemo 429

function client() {
  const token = Buffer.from(`${cfg.key}:${cfg.secret}`).toString("base64");
  return axios.create({
    baseURL: `${cfg.baseUrl}/api/v2`,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Basic ${token}`
    },
    timeout: 30000,
    validateStatus: () => true,
  });
}

async function getWithLimit(url: string) {
  const c = client();
  return await withRetry(
    () => limiter.schedule(async () => {
      const resp = await c.get(url);
      if (resp.status !== 200) {
        const body = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
        throw Object.assign(new Error(`[GET ${url}] ${resp.status} ${body?.slice(0,300)}`), { response: resp });
      }
      return resp.data;
    }),
    { max: 6, baseMs: 1200 }
  );
}

export type MPProduct = {
  id: number;
  name: string;
  variants?: Array<{ id:number; sku:string; ean?:string; price_gross?:number; }>;
};

export async function fetchAllProducts(): Promise<MPProduct[]> {
  let start = 0, limit = 100;
  const all: MPProduct[] = [];
  for (;;) {
    const url = `/products?include=variants&start=${start}&limit=${limit}`;
    const data = await getWithLimit(url);
    const chunk = data?.data ?? data?.products ?? [];
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    all.push(...chunk);
    const hasNext = data?.meta?.links?.next || (chunk.length === limit);
    if (!hasNext) break;
    start += limit;
    await new Promise(r => setTimeout(r, 250));
  }
  return all;
}

/** Samo lista (headeri) porudžbina, bez stavki */
export async function fetchOrdersList(): Promise<any[]> {
  let start = 0, limit = 100;
  const all: any[] = [];
  for (;;) {
    const url = `/orders?start=${start}&limit=${limit}`;
    const data = await getWithLimit(url);
    const chunk = data?.data ?? data?.orders ?? [];
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    all.push(...chunk);
    const hasNext = data?.meta?.links?.next || (chunk.length === limit);
    if (!hasNext) break;
    start += limit;
    await new Promise(r => setTimeout(r, 250));
  }
  return all;
}

/** Pokušaj više detalj ruta da izvučemo stavke porudžbine */
export async function fetchOrderDetail(orderId: string | number): Promise<any> {
  // 1) pokušaj include=products
  try {
    const d1 = await getWithLimit(`/orders/${orderId}?include=products`);
    if (d1 && (d1.products || d1.data?.products)) return d1;
  } catch (_) {}

  // 2) zaseban /products za tu porudžbinu
  try {
    const d2 = await getWithLimit(`/orders/${orderId}/products`);
    // standardizuj na { products: [...] }
    if (Array.isArray(d2?.data)) return { id: orderId, products: d2.data };
    if (Array.isArray(d2?.products)) return d2;
  } catch (_) {}

  // 3) plain detail pa traži polje sa stavkama
  const d3 = await getWithLimit(`/orders/${orderId}`);
  return d3;
}
