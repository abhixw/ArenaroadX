import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Tournaments from "@/pages/Tournaments";
import TournamentDetails from "@/pages/TournamentDetails";
import MyTournaments from "@/pages/MyTournaments";
import Leaderboards from "@/pages/Leaderboards";
import LeaderboardDetail from "@/pages/LeaderboardDetail";
import Prizes from "@/pages/Prizes";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminGames from "@/pages/admin/AdminGames";
import AdminTournaments from "@/pages/admin/AdminTournaments";
import AdminTournamentDetail from "@/pages/admin/AdminTournamentDetail";
import AdminPlayers from "@/pages/admin/AdminPlayers";
import AdminPlayerDetail from "@/pages/admin/AdminPlayerDetail";
import AdminPayments from "@/pages/admin/AdminPayments";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/register"
            element={import.meta.env.VITE_APP_MODE === "admin" ? <Navigate to="/login" replace /> : <Register />}
          />

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

          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/games" element={<AdminGames />} />
            <Route path="/admin/tournaments" element={<AdminTournaments />} />
            <Route path="/admin/tournaments/:id" element={<AdminTournamentDetail />} />
            <Route path="/admin/players" element={<AdminPlayers />} />
            <Route path="/admin/players/:id" element={<AdminPlayerDetail />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
