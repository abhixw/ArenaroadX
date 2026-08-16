import type { LucideIcon } from "lucide-react";
import { cn } from "@shared/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactValue;
  hint?: string;
  tone?: "primary" | "success" | "warning";
}

type ReactValue = string | number;

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-primary-50 text-primary-500",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
};

export function StatCard({ icon: Icon, label, value, hint, tone = "primary" }: StatCardProps) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-extrabold text-gray-900">{value}</p>
        {hint ? <p className="text-xs text-gray-400">{hint}</p> : null}
      </div>
    </div>
  );
}
