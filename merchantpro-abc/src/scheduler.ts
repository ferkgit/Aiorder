import cron from "node-cron";
import { cfg } from "./config";
import { runPipeline } from "./pipeline";

export function startScheduler() {
  cron.schedule(cfg.cronExpr, async () => {
    try {
      const res = await runPipeline();
      console.log(`[CRON] refreshed: products=${res.productsCount} orders=${res.ordersCount}`);
    } catch (e) {
      console.error("[CRON] error:", e);
    }
  });
}
