export function getMatchEstimateRange(rawEstimate: number): { low: number; high: number } {
  const raw = rawEstimate || 0;

  let adjusted = raw * 0.12;

  if (adjusted < 2) adjusted = 2;
  if (adjusted > 120) adjusted = 120;

  const low = Math.max(2, Math.round(adjusted * 0.7));
  const high = Math.round(adjusted * 1.3);

  return { low, high };
}
