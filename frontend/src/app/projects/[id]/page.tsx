"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getApplications,
  createApplication,
} from "@/services/applications";

import { use } from "react";

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const projectId = Number(id);

  const [applications, setApplications] =
    useState<any[]>([]);

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [repoUrl, setRepoUrl] =
    useState("");

  const [branch, setBranch] =
    useState("main");

  const [path, setPath] =
    useState("");

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications() {
  try {
    const data =
      await getApplications(projectId);

    console.log(
      "Applications:",
      data,
    );

    setApplications(data);
  } catch (error) {
    console.error(error);
  }
}

  async function handleCreate() {
    try {
      await createApplication(
        name,
        description,
        repoUrl,
        branch,
        path,
        projectId,
      );

      setName("");
      setDescription("");
      setRepoUrl("");
      setBranch("main");
      setPath("");

      await loadApplications();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-10">
      <h1 className="mb-6 text-3xl font-bold">
        Applications
      </h1>

      <div className="mb-8 rounded-lg border p-4">
        <h2 className="mb-4 text-xl font-semibold">
          Create Application
        </h2>

        <input
          className="mb-3 w-full border p-2"
          placeholder="Application Name"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
        />

        <input
          className="mb-3 w-full border p-2"
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
        />

        <input
          className="mb-3 w-full border p-2"
          placeholder="Repository URL"
          value={repoUrl}
          onChange={(e) =>
            setRepoUrl(e.target.value)
          }
        />

        <input
          className="mb-3 w-full border p-2"
          placeholder="Branch"
          value={branch}
          onChange={(e) =>
            setBranch(e.target.value)
          }
        />

        <input
          className="mb-3 w-full border p-2"
          placeholder="Path"
          value={path}
          onChange={(e) =>
            setPath(e.target.value)
          }
        />

        <button
          onClick={handleCreate}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Create
        </button>
      </div>

      <div className="space-y-4">
        {applications.map((app) => (
  <Link
    key={app.id}
    href={`/applications/${app.id}`}
  >
    <div className="rounded-lg border p-4 hover:bg-gray-100">
      <h2 className="text-xl font-bold">
        {app.name}
      </h2>

      <p>{app.description}</p>

      <p>Repo: {app.repoUrl}</p>

      <p>Branch: {app.branch}</p>

      <p>Path: {app.path}</p>
    </div>
  </Link>
))}
      </div>
    </div>
  );
}
