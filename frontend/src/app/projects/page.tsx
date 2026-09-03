"use client";

import { isAuthenticated } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getProjects,
  createProject,
} from "@/services/projects";

export default function ProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] =
    useState<any[]>([]);

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  useEffect(() => {
  const token =
    localStorage.getItem("token");

  if (!token) {
    window.location.href = "/login";
    return;
  }

  loadProjects();
}, []);

  async function loadProjects() {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCreate() {
    try {
      await createProject(
        name,
        description,
      );

      setName("");
      setDescription("");

      await loadProjects();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-10">
      <h1 className="mb-6 text-3xl font-bold">
        My Projects
      </h1>

      <div className="mb-8 rounded-xl border bg-white p-4 shadow">
        <h2 className="mb-4 text-xl font-semibold">
          Create Project
        </h2>

        <input
          className="mb-3 w-full border p-2"
          placeholder="Project Name"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
        />

        <textarea
          className="mb-3 w-full border p-2"
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
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
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
          >
            <div className="rounded-xl border bg-white p-4 shadow hover:bg-gray-50">
              <h2 className="text-xl font-bold">
                {project.name}
              </h2>

              <p>
                {project.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
