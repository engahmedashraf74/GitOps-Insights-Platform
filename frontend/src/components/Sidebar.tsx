"use client";

import Link from "next/link";

export default function Sidebar() {
  return (
    <div className="h-screen w-64 border-r bg-white p-6">
      <h1 className="mb-8 text-2xl font-bold">
        GitOps Insights
      </h1>

      <nav className="space-y-4">
        <Link
          href="/projects"
          className="block rounded p-2 hover:bg-gray-100"
        >
          📁 Projects
        </Link>

        <Link
          href="/dashboard"
          className="block rounded p-2 hover:bg-gray-100"
        >
          📊 Dashboard
        </Link>
      </nav>
    </div>
  );
}
