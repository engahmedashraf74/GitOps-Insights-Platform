"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PasswordInput,
  passwordStrength,
} from "@/components/ui/password-input";
import { register as registerAccount } from "@/services/auth";
import { isAuthenticated, setToken } from "@/lib/auth";
import { getPreferences, savePreferences } from "@/lib/settings";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => passwordStrength(password), [password]);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!username.trim()) {
      setError("Choose a username.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!accepted) {
      setError("Accept the terms to continue.");
      return;
    }

    setLoading(true);
    try {
      const data = await registerAccount(email.trim(), password);
      if (!data?.access_token) {
        setError("Account created but no access_token was returned.");
        return;
      }
      setToken(data.access_token);
      savePreferences({ ...getPreferences(), username: username.trim() });
      setSuccess("Account created. Redirecting to your workspace.");
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
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
            Create a workspace account.
          </p>
          <p className="mt-4 max-w-md text-sm text-zinc-400">
            Username is stored locally until profile APIs exist. Authentication
            currently uses email and password.
          </p>
        </div>
        <p className="text-xs text-zinc-600">V1 · Platform engineering</p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111113]/80 p-6 shadow-2xl"
        >
          <h1 className="text-2xl font-semibold">Create account</h1>
          {error ? (
            <p className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
              {success}
            </p>
          ) : null}
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm" htmlFor="username">
                Username
              </label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <PasswordInput
              id="password"
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div>
              <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-teal-400"
                  style={{ width: `${(strength.score / 4) * 100}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500">{strength.label}</p>
            </div>
            <PasswordInput
              id="confirm"
              label="Confirm password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            <label className="flex items-start gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                className="mt-1"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              I agree to the product terms and acceptable use for this workspace.
            </label>
            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>
          </div>
          <p className="mt-6 text-center text-sm text-zinc-400">
            Already registered?{" "}
            <Link href="/login" className="text-teal-300">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
