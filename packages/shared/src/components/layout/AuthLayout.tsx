import type { ReactNode } from "react";
import { Shield } from "lucide-react";

// Shared shell for every pre-login page (Login, Register, ForgotPassword, ResetPassword) --
// the logo header, centered card, and footer-link slot were previously copy-pasted across
// all four.
export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500 text-white">
            <Shield size={22} fill="currentColor" />
          </div>
          <p className="text-xl font-extrabold text-gray-900">ArenaroadX</p>
        </div>

        <div className="card p-6">{children}</div>

        {footer ? <p className="mt-4 text-center text-sm text-gray-500">{footer}</p> : null}
      </div>
    </div>
  );
}
