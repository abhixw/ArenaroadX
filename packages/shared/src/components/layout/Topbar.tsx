import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

interface TopbarProps {
  title: ReactNode;
  subtitle?: ReactNode;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/tournaments?search=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      </div>

      <form onSubmit={onSearchSubmit} className="relative hidden md:block">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          aria-label="Search tournaments"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tournaments..."
          className="w-64 rounded-full border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
        />
      </form>
    </div>
  );
}
