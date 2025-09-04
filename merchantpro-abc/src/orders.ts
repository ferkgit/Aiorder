// src/orders.ts
export type SaleRow = { sku: string; qty: number; revenue: number; date?: string };

function num(x: any, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

// MerchantPro ume da vrati stavke u više polja/naziva.
// Ova funkcija pokušava nekoliko tipičnih lokacija i polja.
function extractItemsArray(order: any): any[] {
  if (!order) return [];
  // najčešće varijante:
  if (Array.isArray(order.items)) return order.items;
  if (Array.isArray(order.products)) return order.products;
  if (Array.isArray(order.order_products)) return order.order_products;
  if (order.cart && Array.isArray(order.cart.products)) return order.cart.products;
  // fallback: potraži prvo polje koje je niz i sadrži “sku/quantity/price”
  for (const k of Object.keys(order)) {
    const v = (order as any)[k];
    if (Array.isArray(v) && v.length && typeof v[0] === "object") {
      return v;
    }
  }
  return [];
}

function extractSKU(it: any): string | null {
  return (
    it?.sku ??
    it?.product_sku ??
    it?.variant_sku ??
    it?.product?.sku ??
    it?.variant?.sku ??
    it?.code ??
    null
  );
}

function extractQty(it: any): number {
  return (
    num(it?.quantity) ||
    num(it?.qty) ||
    num(it?.amount) ||
    0
  );
}

function extractPriceGross(it: any): number {
  // tipična polja: price_gross, price, gross, total_gross; fallback: total/qty
  const p =
    num(it?.price_gross) ||
    num(it?.gross) ||
    num(it?.price) ||
    num(it?.total_gross) ||
    0;

  if (p) return p;

  // fallback kada postoji total i quantity
  const total =
    num(it?.total) ||
    num(it?.total_price) ||
    num(it?.sum) ||
    0;

  const q = extractQty(it) || 1;
  return q ? total / q : 0;
}

export function explodeOrderToSales(order: any): SaleRow[] {
  const items = extractItemsArray(order);
  const when =
    order?.created_at ||
    order?.date ||
    order?.ordered_at ||
    order?.created ||
    undefined;

  const rows = items
    .map((it: any) => {
      const sku = extractSKU(it);
      const qty = extractQty(it);
      const price = extractPriceGross(it);
      if (!sku || !qty || !price) return null;
      return { sku, qty, revenue: qty * price, date: when };
    })
    .filter(Boolean) as SaleRow[];

  return rows;
}
