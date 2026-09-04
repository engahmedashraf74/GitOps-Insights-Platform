"use client";

import { use, useEffect, useState } from "react";
import { getOverview } from "@/services/dashboard";

export default function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const applicationId = Number(id);

  const [overview, setOverview] =
    useState<any>(null);

  const [environments, setEnvironments] =
    useState<any[]>([]);

  const [environmentName, setEnvironmentName] =
    useState("");

  useEffect(() => {
    loadDashboard();
    loadEnvironments();
  }, []);

  async function loadDashboard() {
    try {
      const data =
        await getOverview(applicationId);

      setOverview(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadEnvironments() {
    try {
      const response = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
      );

      const data = await response.json();

      setEnvironments(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function createEnvironment() {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/environments`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: environmentName,
            applicationId,
          }),
        },
      );

      setEnvironmentName("");

      await loadEnvironments();
    } catch (error) {
      console.error(error);
    }
  }

  if (!overview) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-10">
      <h1 className="mb-8 text-4xl font-bold">
        Application Dashboard
      </h1>

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-6 shadow">
          <h2 className="text-sm text-gray-500">
            Total Deployments
          </h2>

          <p className="mt-2 text-4xl font-bold">
            {
              overview.stats
                .totalDeployments
            }
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow">
          <h2 className="text-sm text-gray-500">
            Success Rate
          </h2>

          <p className="mt-2 text-4xl font-bold text-green-600">
            {
              overview.stats
                .successRate
            }
            %
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow">
          <h2 className="text-sm text-gray-500">
            Failure Rate
          </h2>

          <p className="mt-2 text-4xl font-bold text-red-600">
            {
              overview.failureRate
                .failureRate
            }
            %
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow">
          <h2 className="text-sm text-gray-500">
            Deployments
          </h2>

          <p className="mt-2 text-4xl font-bold">
            {
              overview.frequency
                .deployments
            }
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow">
        <h2 className="mb-4 text-2xl font-bold">
          Deployment Timeline
        </h2>

        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="py-3 text-left">
                Revision
              </th>

              <th className="py-3 text-left">
                Status
              </th>

              <th className="py-3 text-left">
                Sync
              </th>

              <th className="py-3 text-left">
                Health
              </th>
            </tr>
          </thead>

          <tbody>
            {overview.timeline.map(
              (
                deployment: any,
                index: number,
              ) => (
                <tr
                  key={index}
                  className="border-b"
                >
                  <td className="py-3">
                    {
                      deployment.revision
                    }
                  </td>

                  <td className="py-3">
                    {
                      deployment.status
                    }
                  </td>

                  <td className="py-3">
                    {
                      deployment.syncStatus
                    }
                  </td>

                  <td className="py-3">
                    {
                      deployment.healthStatus
                    }
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 rounded-xl border bg-white p-6 shadow">
        <h2 className="mb-4 text-2xl font-bold">
          Environments
        </h2>

        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded border p-2"
            placeholder="Environment Name"
            value={environmentName}
            onChange={(e) =>
              setEnvironmentName(
                e.target.value,
              )
            }
          />

          <button
            onClick={createEnvironment}
            className="rounded bg-black px-4 py-2 text-white"
          >
            Create
          </button>
        </div>

        <div className="space-y-2">
          {environments.map(
            (environment: any) => (
              <div
                key={environment.id}
                className="rounded border p-3"
              >
                {environment.name}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
