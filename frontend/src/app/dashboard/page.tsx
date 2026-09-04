"use client";

import { useEffect, useState } from "react";
import DeploymentsChart from "@/components/charts/DeploymentsChart";
export default function DashboardPage() {
  const [stats, setStats] = useState({
    projects: 0,
    applications: 0,
    deployments: 0,
    successRate: 100,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const projectsResponse =
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem(
                  "token",
                )}`,
              },
            },
          );

        const projects =
          await projectsResponse.json();

        let applicationsCount = 0;

        for (const project of projects) {
          const applicationsResponse = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL}/applications/${project.id}`
);

          const applications =
            await applicationsResponse.json();

          applicationsCount +=
            applications.length;
        }

        setStats({
          projects: projects.length,
          applications:
            applicationsCount,
          deployments:
            applicationsCount,
          successRate: 100,
        });
      } catch (error) {
        console.error(error);
      }
    }

    loadData();
  }, []);

  return (
    <div className="p-10">
      <h1 className="mb-8 text-4xl font-bold">
        Dashboard
      </h1>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-lg font-semibold">
            Projects
          </h2>

          <p className="mt-2 text-4xl font-bold">
            {stats.projects}
          </p>
        </div>

        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-lg font-semibold">
            Applications
          </h2>

          <p className="mt-2 text-4xl font-bold">
            {stats.applications}
          </p>
        </div>

        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-lg font-semibold">
            Deployments
          </h2>

          <p className="mt-2 text-4xl font-bold">
            {stats.deployments}
          </p>
        </div>

        <div className="rounded-xl border p-6 shadow">
          <h2 className="text-lg font-semibold">
            Success Rate
          </h2>

          <p className="mt-2 text-4xl font-bold">
            {stats.successRate}%
          </p>
        </div>
            </div>

      <div className="mt-8">
        <DeploymentsChart />
      </div>
    </div>
  );
}
