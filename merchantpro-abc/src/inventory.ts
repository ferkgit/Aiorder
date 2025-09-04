import { cfg } from "./config";
import axios from "axios";
import { Buffer } from "buffer";

function client() {
  const token = Buffer.from(`${cfg.key}:${cfg.secret}`).toString("base64");
  return axios.create({
    baseURL: `${cfg.baseUrl}/api/v2`,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Basic ${token}`
    },
    timeout: 30000
  });
}

/** Vrati trenutno stanje lagera za dati SKU (ako API to podržava po SKU) */
export async function getStockBySKU(sku: string): Promise<number | null> {
  try {
    const c = client();
    // Primer rute; zavisi od MP: /inventory/sku/{sku}
    const { data } = await c.get(`/inventory/sku/${encodeURIComponent(sku)}`);
    // Prilagodi field-ove u skladu sa realnim payload-om MerchantPro:
    const stock = data?.data?.stock ?? data?.stock ?? null;
    return typeof stock === "number" ? stock : (stock ? Number(stock) : null);
  } catch {
    return null;
  }
}
