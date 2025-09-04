import { fetchAllProducts, fetchOrdersList, fetchOrderDetail } from "./merchantpro";
import { explodeOrderToSales, SaleRow } from "./orders";
import { buildABC } from "./abc";
import { dailyUse, reorderPoint, targetStock } from "./rop";
import { cfg } from "./config";
import pLimit from "p-limit";
import { getStockBySKU } from "./inventory";
import { db } from "./db";

export async function runPipeline(today = new Date(), opts?: { withInventory?: boolean }) {
  // 1) proizvodi
  const products = await fetchAllProducts();
  // upis u bazu
  await db("products").delete();
  if (products.length) {
    await db.batchInsert(
      "products",
      products.map(p => ({ id: p.id, data: JSON.stringify(p) })),
      30
    );
  }
  await new Promise(r => setTimeout(r, 300));

  // 2) lista porudžbina (headeri)
  const ordersHeaders = await fetchOrdersList();

  // 3) povuci DETALJE sa stavkama, ali pod umerenim paralelizmom
  const limit = pLimit(2);
  const details = await Promise.all(
    ordersHeaders.map(h => limit(async () => {
      const od = await fetchOrderDetail(h.id || h.order_id || h.sys_id);
      // probaj da "merge"-uješ datum u detail zbog kasnije upotrebe
      if (od && !od.date && !od.date_created) {
        od.date_created = h.date_created || h.date || h.created_at;
      }
      return od;
    }))
  );

  // upis porudžbina u bazu
  await db("orders").delete();
  if (details.length) {
    await db.batchInsert(
      "orders",
      details.map(d => ({
        id: Number(d.id || d.order_id || d.sys_id),
        data: JSON.stringify(d)
      })),
      30
    );
  }

  // 4) razvuci stavke u SaleRow
  const sales: SaleRow[] = details.flatMap(explodeOrderToSales);

  // 5) ABC
  const abc = buildABC(sales);

  // 6) qty po SKU + sezona
  const qtyPerSKU = new Map<string, number>();
  for (const s of sales) qtyPerSKU.set(s.sku, (qtyPerSKU.get(s.sku) || 0) + s.qty);

  const month = String(today.getMonth() + 1);
  const season = cfg.seasonMultipliers[month] ?? 1;

  // 7) nacrt predloga
  const draft = abc.map(r => {
    const qtyYear = qtyPerSKU.get(r.sku) || 0;
    const d = dailyUse(qtyYear, season);
    const safety = r.cls === "A" ? cfg.safetyA : r.cls === "B" ? cfg.safetyB : cfg.safetyC;
    const rop = reorderPoint(d, cfg.defaultLeadTime, safety);
    const tgt = targetStock(d, cfg.defaultLeadTime, safety, 14);
    return { sku: r.sku, class: r.cls as "A"|"B"|"C", qtyYear, daily: Number(d.toFixed(3)), rop, target: tgt, onHand: null as number | null, suggestOrder: tgt };
  });

  // 8) (opciono) povuci onHand
  if (opts?.withInventory) {
    const lim2 = pLimit(2);
    await Promise.all(
      draft.map(item => lim2(async () => {
        const onHand = await getStockBySKU(item.sku);
        item.onHand = onHand;
        item.suggestOrder = Math.max(0, item.target - (onHand ?? 0));
      }))
    );
  }

  return {
    productsCount: products.length,
    ordersCount: ordersHeaders.length,
    abc,
    suggestions: draft
  };
}
