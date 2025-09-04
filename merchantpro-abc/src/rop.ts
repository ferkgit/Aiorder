export function dailyUse(qtyYear: number, seasonMultiplier: number) {
  return (qtyYear / 365) * (seasonMultiplier || 1);
}

export function reorderPoint(daily: number, leadDays: number, safetyDays: number) {
  return Math.ceil(daily * leadDays + daily * safetyDays);
}

export function targetStock(daily: number, leadDays: number, safetyDays: number, horizonDays = 14) {
  return Math.ceil(daily * (leadDays + safetyDays + horizonDays));
}
