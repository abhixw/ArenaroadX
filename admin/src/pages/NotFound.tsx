import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@shared/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-app-bg px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-500">
        <Compass size={26} />
      </div>
      <p className="text-3xl font-extrabold text-gray-900">404</p>
      <p className="text-sm text-gray-500">This page doesn't exist, or the match already ended.</p>
      <Link to="/">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  );
}
