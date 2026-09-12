"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { login } from "@/services/auth";
import {
  getRememberedEmail,
  isAuthenticated,
  setRememberedEmail,
  setToken,
} from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
      return;
    }
    const remembered = getRememberedEmail();
    if (remembered) {
      setEmail(remembered);
      setRemember(true);
    }
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Enter your email or username.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      if (!data?.access_token) {
        setError("Login succeeded but no access_token was returned.");
        return;
      }
      setToken(data.access_token);
      setRememberedEmail(remember ? email.trim() : null);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-white/8 bg-[#0c0c0e] p-10 lg:flex">
        <Link href="/" className="text-sm font-semibold">
          GitOps Insights
        </Link>
        <div>
          <p className="text-3xl font-semibold tracking-tight">
            Operational clarity for GitOps delivery.
          </p>
          <p className="mt-4 max-w-md text-sm text-zinc-400">
            Sign in to inspect application health, sync state, and deployment
            history across environments.
          </p>
        </div>
        <p className="text-xs text-zinc-600">V1 · Platform engineering</p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111113]/80 p-6 shadow-2xl"
        >
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Use the email associated with your account.
          </p>
          {error ? (
            <p className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-zinc-300" htmlFor="email">
                Email or username
              </label>
              <Input
                id="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <PasswordInput
              id="password"
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-zinc-400">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-teal-300"
                onClick={() =>
                  setError(
                    "Password reset is not available in this release. Contact your workspace admin.",
                  )
                }
              >
                Forgot password
              </button>
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              Login
            </Button>
          </div>
          <div className="mt-6 grid gap-2">
            <button
              type="button"
              disabled
              className="h-10 rounded-lg border border-white/10 text-sm text-zinc-500"
            >
              Continue with GitHub · Coming soon
            </button>
            <button
              type="button"
              disabled
              className="h-10 rounded-lg border border-white/10 text-sm text-zinc-500"
            >
              Continue with Google · Coming soon
            </button>
          </div>
          <p className="mt-6 text-center text-sm text-zinc-400">
            No account?{" "}
            <Link href="/register" className="text-teal-300">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
