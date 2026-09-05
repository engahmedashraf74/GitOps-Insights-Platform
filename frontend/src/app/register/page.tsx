"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://192.168.49.2:30000";

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("token")) {
      router.push("/projects");
    }
  }, [router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleRegister() {
    try {
      setError("");

      const response = await fetch(
        `${API_URL}/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Registration failed",
        );
      }

      localStorage.setItem(
        "token",
        data.access_token,
      );

      router.push("/projects");
    } catch (err: any) {
      setError(
        err.message || "Registration failed",
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-3xl font-bold">
          Register
        </h1>

        {error && (
          <p className="mb-4 text-red-500">
            {error}
          </p>
        )}

        <input
          type="email"
          placeholder="Email"
          className="mb-4 w-full border p-3"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />

        <input
          type="password"
          placeholder="Password"
          className="mb-4 w-full border p-3"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />

        <button
          onClick={handleRegister}
          className="w-full rounded bg-black p-3 text-white"
        >
          Register
        </button>

        <p className="mt-4 text-center">
          Already have an account?{" "}
          <a
            href="/login"
            className="font-bold"
          >
            Login
          </a>
        </p>
      </div>
    </div>
  );
}
