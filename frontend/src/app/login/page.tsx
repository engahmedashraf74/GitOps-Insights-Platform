"use client";
import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/services/auth";

export default function LoginPage() {
  const router = useRouter();
useEffect(() => {
  if (localStorage.getItem("token")) {
    router.push("/projects");
  }
}, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const data = await login(
        email,
        password,
      );

      console.log(data);

      localStorage.setItem(
        "token",
        data.access_token,
      );

      router.push("/projects");
    } catch (error) {
      console.error(error);
      alert("Login Failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-96 rounded-lg border p-6">
        <h1 className="mb-4 text-2xl font-bold">
          GitOps Insights
        </h1>

        <input
          className="mb-3 w-full border p-2"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
        />

        <input
          type="password"
          className="mb-3 w-full border p-2"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
        />

        <button
  onClick={handleLogin}
  className="w-full rounded bg-black p-2 text-white"
>
  Login
</button>

<p className="mt-4 text-center">
  Don't have an account?{" "}
  <a
    href="/register"
    className="font-bold text-blue-600"
  >
    Register
  </a>
</p>
      </div>
    </div>
  );
}
