import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { FormError } from "@shared/components/ui/FormError";
import { AuthLayout } from "@shared/components/layout/AuthLayout";
import { useAuth } from "@shared/hooks/useAuth";
import { ApiError } from "@shared/api/client";

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
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
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <p className="text-lg font-bold text-gray-900">Admin sign in</p>
      <p className="mt-1 text-sm text-gray-500">Manage tournaments, players, and payouts.</p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3" autoComplete="off">
        <div>
          <label className="text-xs font-semibold text-gray-500">Email</label>
          <input
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500">Password</label>
            <Link to="/forgot-password" className="text-xs font-semibold text-primary-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
        {error ? <FormError message={error} /> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Log In"}
        </Button>
      </form>
    </AuthLayout>
  );
}
