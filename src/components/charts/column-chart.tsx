"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Colunas de uma série (magnitude ao longo do tempo). Segue as regras de dataviz do
 * projeto: barra fina (≤ 24 px) com ponta arredondada, grade discreta, um só eixo,
 * tooltip com o valor em destaque. Cor: acento da marca (validado nos dois temas).
 */
export type ColumnDatum = { label: string; fullLabel: string; value: number };

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }>; unit: string };

function ChartTooltip({ active, payload, unit }: TooltipProps) {
  const datum = payload?.[0]?.payload as ColumnDatum | undefined;
  if (!active || !datum) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm shadow-float">
      <p className="font-display text-base font-bold tabular-nums">
        {datum.value.toLocaleString("pt-BR")} <span className="text-xs font-semibold text-muted-foreground">{unit}</span>
      </p>
      <p className="text-xs text-muted-foreground">{datum.fullLabel}</p>
    </div>
  );
}

export function ColumnChart({ data, unit, height = 180, ariaLabel }: { data: ColumnDatum[]; unit: string; height?: number; ariaLabel: string }) {
  return (
    <div role="img" aria-label={ariaLabel} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
            minTickGap={14}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v))}
          />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={(props) => <ChartTooltip active={props.active} payload={props.payload} unit={unit} />} />
          <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
