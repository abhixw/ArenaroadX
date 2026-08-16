import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@shared/hooks/useAuth";

// Rendered when a session's role doesn't belong in this app (e.g. a player account landing
// on the admin app, or vice versa). The player and admin dashboards are separate deployments
// now -- there's no local route to send the wrong role to (unlike the old single-app setup,
// which could just <Navigate> to the other section) -- so this logs the mismatched session
// out instead. Once AuthContext's `user` flips to null, the layout that rendered this
// re-renders and its own "no user" branch sends the browser to this app's own /login.
export function RoleMismatchRedirect() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-app-bg">
      <Loader2 size={28} className="animate-spin text-primary-500" />
    </div>
  );
}
