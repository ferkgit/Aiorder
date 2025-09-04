import "dotenv/config";

export const cfg = {
  baseUrl: process.env.MP_BASE_URL!,
  key: process.env.MP_KEY!,
  secret: process.env.MP_SECRET!,
  lookbackDays: parseInt(process.env.ORDERS_LOOKBACK_DAYS || "540", 10),
  defaultLeadTime: parseInt(process.env.DEFAULT_LEAD_TIME_DAYS || "10", 10),
  safetyA: parseInt(process.env.SAFETY_A_DAYS || "15", 10),
  safetyB: parseInt(process.env.SAFETY_B_DAYS || "7", 10),
  safetyC: parseInt(process.env.SAFETY_C_DAYS || "2", 10),
  seasonMultipliers: JSON.parse(process.env.SEASON_MULTIPLIERS || "{}") as Record<string, number>,
  cronExpr: process.env.CRON_EXPR || "30 6 * * *",
  port: parseInt(process.env.PORT || "8080", 10)
};

if (!cfg.baseUrl || !cfg.key || !cfg.secret) {
  throw new Error("Missing MP_BASE_URL / MP_KEY / MP_SECRET in .env");
}
