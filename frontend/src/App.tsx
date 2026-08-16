import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@shared/contexts/AuthContext";
import { ErrorBoundary } from "@shared/components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

// Route-level code splitting: everything past the login/register screen is lazy-loaded,
// so a first-time visitor's initial download is just the auth shell, not the rest of the app.
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Tournaments = lazy(() => import("@/pages/Tournaments"));
const TournamentDetails = lazy(() => import("@/pages/TournamentDetails"));
const MyTournaments = lazy(() => import("@/pages/MyTournaments"));
const Leaderboards = lazy(() => import("@/pages/Leaderboards"));
const LeaderboardDetail = lazy(() => import("@/pages/LeaderboardDetail"));
const Prizes = lazy(() => import("@/pages/Prizes"));
const Profile = lazy(() => import("@/pages/Profile"));

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-primary-500" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/tournaments/:id" element={<TournamentDetails />} />
                <Route path="/my-tournaments" element={<MyTournaments />} />
                <Route path="/leaderboards" element={<Leaderboards />} />
                <Route path="/leaderboards/:id" element={<LeaderboardDetail />} />
                <Route path="/prizes" element={<Prizes />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
