import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { FormError } from "@shared/components/ui/FormError";
import { AuthLayout } from "@shared/components/layout/AuthLayout";
import { ApiError } from "@shared/api/client";
import { forgotPassword } from "@shared/api/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await forgotPassword(email);
      // Shown whether or not the email has an account -- the backend never reveals that,
      // so the frontend can't either.
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      footer={
        <>
          Remembered your password?{" "}
          <Link to="/login" className="font-semibold text-primary-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {sent ? (
        <>
          <p className="text-lg font-bold text-gray-900">Check your email</p>
          <p className="mt-1 text-sm text-gray-500">
            If an account exists for <span className="font-medium text-gray-700">{email}</span>, we've sent a
            link to reset your password. Check the email for how long it stays valid.
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-bold text-gray-900">Forgot your password?</p>
          <p className="mt-1 text-sm text-gray-500">Enter your email and we'll send you a reset link.</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            {error ? <FormError message={error} /> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Send Reset Link"}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
