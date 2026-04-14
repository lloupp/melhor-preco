"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = {
  date: string;
  value: number;
  marketName: string;
};

export function PriceHistoryChart({ points }: { points: Point[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-slate-500">Historico insuficiente para desenhar o grafico.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <CartesianGrid stroke="#e6ded3" strokeDasharray="4 4" />
          <XAxis dataKey="date" tick={{ fill: "#5b6b73", fontSize: 12 }} />
          <YAxis tick={{ fill: "#5b6b73", fontSize: 12 }} />
          <Tooltip
            formatter={(value: number) =>
              new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
            }
            labelFormatter={(label) => `Data ${label}`}
            contentStyle={{ borderRadius: 16, borderColor: "#d7cec1", boxShadow: "0 18px 45px rgba(39, 52, 59, 0.08)" }}
          />
          <Line type="monotone" dataKey="value" stroke="#0d7a67" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#0d7a67" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
