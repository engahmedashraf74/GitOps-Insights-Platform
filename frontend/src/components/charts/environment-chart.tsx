"use client";

import type { EnvironmentComparison } from "@/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function EnvironmentChart({ data }: { data: EnvironmentComparison[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: "#71717a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="environment"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={88}
          />
          <Tooltip
            contentStyle={{
              background: "#111113",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
            }}
          />
          <Bar dataKey="deployments" fill="#2dd4bf" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
