"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// F-RPT-03 / F-RPT-04 — กราฟแนวโน้ม (แท่งซ้อน) และสัดส่วนสถานะ (โดนัท) ด้วย Recharts
// ข้อความสรุปของกราฟส่งมาเป็น aria-label ให้ screen reader ส่วนตัวเลขครบอยู่ในรายการข้างกราฟ

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  color: "var(--color-foreground)",
  fontSize: 12,
};
const tick = { fontSize: 10, fill: "var(--color-muted-foreground)" };

export type TrendPoint = { label: string } & Record<string, number | string>;

export function TrendChart({
  data,
  series,
  summary,
}: {
  data: TrendPoint[];
  series: { key: string; label: string; color: string }[];
  summary: string;
}) {
  return (
    <div className="h-[220px] w-full" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
          barCategoryGap="20%"
        >
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={tick}
            interval="preserveStartEnd"
            minTickGap={10}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={tick} width={40} />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.6 }}
            contentStyle={tooltipStyle}
          />
          {series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              stackId="status"
              fill={item.color}
              radius={index === series.length - 1 ? [3, 3, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonut({
  data,
  total,
  totalLabel,
  summary,
}: {
  data: { key: string; label: string; value: number; fill: string }[];
  total: string;
  totalLabel: string;
  summary: string;
}) {
  const visible = data.filter((item) => item.value > 0);
  const slices = visible.length
    ? visible
    : [{ key: "empty", label: "", value: 1, fill: "var(--color-muted)" }];

  return (
    <div className="relative size-[132px] shrink-0" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius={44}
            outerRadius={64}
            paddingAngle={slices.length > 1 ? 1.5 : 0}
            stroke="none"
            isAnimationActive={false}
          />
          {visible.length > 0 && <Tooltip contentStyle={tooltipStyle} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[20px] font-bold tabular-nums">{total}</span>
        <span className="text-[10px] text-muted-foreground">{totalLabel}</span>
      </div>
    </div>
  );
}
