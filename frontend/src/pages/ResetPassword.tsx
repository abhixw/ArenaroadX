import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { FormError } from "@shared/components/ui/FormError";
import { AuthLayout } from "@shared/components/layout/AuthLayout";
import { ApiError } from "@shared/api/client";
import { resetPassword } from "@shared/api/auth";
import { passwordError, PASSWORD_MAX_LENGTH } from "@shared/lib/utils";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const pwError = passwordError(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token ?? "", password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      footer={
        <Link to="/login" className="font-semibold text-primary-600 hover:underline">
          Back to log in
        </Link>
      }
    >
      {!token ? (
        <>
          <p className="text-lg font-bold text-gray-900">Invalid reset link</p>
          <p className="mt-1 text-sm text-gray-500">
            This password reset link is missing its token. Request a new one to continue.
          </p>
        </>
      ) : done ? (
        <>
          <p className="text-lg font-bold text-gray-900">Password reset</p>
          <p className="mt-1 text-sm text-gray-500">Your password has been changed. You can now log in.</p>
        </>
      ) : (
        <>
          <p className="text-lg font-bold text-gray-900">Set a new password</p>
          <p className="mt-1 text-sm text-gray-500">Choose a new password for your account.</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500">New password</label>
              <input
                type="password"
                required
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                At least 8 characters, with an uppercase letter, a lowercase letter, and a digit.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Confirm new password</label>
              <input
                type="password"
                required
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            {error ? <FormError message={error} /> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Reset Password"}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
