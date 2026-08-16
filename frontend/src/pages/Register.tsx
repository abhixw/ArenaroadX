import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { FormError } from "@shared/components/ui/FormError";
import { AuthLayout } from "@shared/components/layout/AuthLayout";
import { useAuth } from "@shared/hooks/useAuth";
import { ApiError } from "@shared/api/client";
import { passwordError, PASSWORD_MAX_LENGTH, NAME_MAX_LENGTH } from "@shared/lib/utils";

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
    const pwError = passwordError(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    const cleanedPhone = phone.replace(/[^\d+]/g, "");
    if (!/^\+?\d{10,15}$/.test(cleanedPhone)) {
      setError("Phone number must be 10-15 digits, with an optional leading +.");
      return;
    }
    setBusy(true);
    try {
      await register(name, email, password, cleanedPhone);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <p className="text-lg font-bold text-gray-900">Create your account</p>
      <p className="mt-1 text-sm text-gray-500">Join tournaments and start climbing the leaderboard.</p>

      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-500">Name</label>
          <input
            required
            maxLength={NAME_MAX_LENGTH}
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
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            At least 8 characters, with an uppercase letter, a lowercase letter, and a digit.
          </p>
        </div>
        {error ? <FormError message={error} /> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Create Account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
