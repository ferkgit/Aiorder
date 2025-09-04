import { SaleRow } from "./orders";

export type ABCRow = { sku: string; qty: number; revenue: number; cls: "A"|"B"|"C"; share: number; };

export function buildABC(rows: SaleRow[]): ABCRow[] {
  const sums = new Map<string, { qty:number; revenue:number }>();
  for (const r of rows) {
    const curr = sums.get(r.sku) ?? { qty:0, revenue:0 };
    curr.qty += r.qty;
    curr.revenue += r.revenue;
    sums.set(r.sku, curr);
  }
  const merged = [...sums.entries()].map(([sku, v]) => ({ sku, qty: v.qty, revenue: v.revenue }));
  const totalRevenue = merged.reduce((s, r) => s + r.revenue, 0) || 1;
  merged.sort((a,b)=> b.revenue - a.revenue);

  let cum = 0;
  return merged.map(m => {
    cum += m.revenue;
    const share = cum / totalRevenue;
    const cls = share <= 0.8 ? "A" : share <= 0.95 ? "B" : "C";
    return { ...m, cls, share };
  });
}
