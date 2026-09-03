"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DeploymentsChart() {
  const data = [
    { name: "Mon", deployments: 2 },
    { name: "Tue", deployments: 4 },
    { name: "Wed", deployments: 3 },
    { name: "Thu", deployments: 6 },
    { name: "Fri", deployments: 5 },
  ];

  return (
    <div className="rounded-xl border p-4 shadow">
      <h2 className="mb-4 text-xl font-bold">
        Deployments Activity
      </h2>

      <ResponsiveContainer
        width="100%"
        height={300}
      >
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="deployments" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
