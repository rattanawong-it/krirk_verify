// ระยะเวลาแบบย่อตามดีไซน์หน้า sync: 0.8s · 48s · 4m 02s · 1h 05m
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${(Math.max(ms, 0) / 1000).toFixed(1)}s`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${String(totalSeconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
