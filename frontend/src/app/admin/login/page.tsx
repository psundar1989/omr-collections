"use client";

import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { errorMessage } from "@/lib/admin-api";
import { adminTokenStore } from "@/lib/store";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiRequest<{ data: { token: string } }>("/admin/login", { method: "POST", body: JSON.stringify({ email, password }) });
      adminTokenStore.set(r.data.token);
      router.replace("/admin");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream"><Lock className="h-5 w-5 text-gold-dark" /></span>
          <h1 className="mt-3 text-xl font-semibold">Admin login</h1>
          <p className="text-sm text-muted">Manage products, prices and orders</p>
        </div>
        <label className="block"><span className="label">Email</span><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="mt-4 block"><span className="label">Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="mt-4 rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose">{error}</p>}
        <button className="btn-primary mt-6 w-full py-3" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in</button>
      </form>
    </div>
  );
}
