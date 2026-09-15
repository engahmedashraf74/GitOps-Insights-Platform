"use client";

import { Button } from "@/components/ui/button";
import { setToken } from "@/lib/auth";
import { resendVerification, verifyEmail } from "@/services/auth";
import { ApiError } from "@/services/api";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"idle" | "working" | "ok" | "error">(
    token ? "working" : "idle",
  );
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const data = await verifyEmail(token);
        if (!data.access_token) {
          setStatus("error");
          setMessage("Verification succeeded but no session token was returned.");
          return;
        }
        setToken(data.access_token);
        setStatus("ok");
        setTimeout(() => router.replace("/onboarding"), 800);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Verification failed.");
      }
    })();
  }, [router, token]);

  async function onResend(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await resendVerification(email.trim());
      setMessage("If that account exists and is unverified, a new email was sent.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not resend email.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="w-full rounded-2xl border border-white/10 bg-[#111113]/80 p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-teal-300">Public Beta</p>
        <h1 className="mt-2 text-2xl font-semibold">Verify your email</h1>
        {status === "working" ? (
          <p className="mt-4 text-sm text-zinc-400">Confirming your address…</p>
        ) : null}
        {status === "ok" ? (
          <p className="mt-4 text-sm text-emerald-200">
            Email verified. Redirecting to your workspace.
          </p>
        ) : null}
        {status === "error" || status === "idle" ? (
          <>
            <p className="mt-3 text-sm text-zinc-400">
              {message ||
                "Enter the email you registered with to resend the verification link."}
            </p>
            <form onSubmit={(event) => void onResend(event)} className="mt-4 space-y-3">
              <input
                className="h-11 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Button type="submit" className="w-full">
                Resend verification
              </Button>
            </form>
          </>
        ) : null}
        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/login" className="text-teal-300">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
