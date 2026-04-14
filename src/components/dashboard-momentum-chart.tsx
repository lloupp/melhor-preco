"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = {
  name: string;
  variation: number;
  statusCode: string;
};

export function DashboardMomentumChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Nao ha variacoes suficientes para desenhar o panorama do periodo.</p>;
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
          <XAxis type="number" tick={{ fill: "#5b6b73", fontSize: 12 }} />
          <YAxis dataKey="name" type="category" width={130} tick={{ fill: "#1d2a2f", fontSize: 12 }} />
          <Tooltip formatter={(value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`} />
          <Bar dataKey="variation" radius={[0, 10, 10, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.variation >= 0 ? (entry.statusCode === "acima_faixa" ? "#c4552d" : "#d08a11") : "#2d7e3f"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
