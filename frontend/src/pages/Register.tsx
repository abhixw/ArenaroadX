import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/api/client";

export default function Register() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(name, email, password, phone);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500 text-white">
            <Shield size={22} fill="currentColor" />
          </div>
          <p className="text-xl font-extrabold text-gray-900">ArenaroadX</p>
        </div>

        <div className="card p-6">
          <p className="text-lg font-bold text-gray-900">Create your account</p>
          <p className="mt-1 text-sm text-gray-500">Join tournaments and start climbing the leaderboard.</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Phone</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                At least 8 characters, with an uppercase letter, a lowercase letter, and a digit.
              </p>
            </div>
            {error ? (
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger-600">{error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Create Account"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
