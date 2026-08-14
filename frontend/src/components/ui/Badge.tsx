import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type {
  PaymentStatus,
  PrizeStatus,
  RegistrationStatus,
  TournamentStatus,
} from "@/types";

type Tone = "success" | "warning" | "danger" | "info" | "gray" | "primary";

const toneClasses: Record<Tone, string> = {
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  info: "bg-info-50 text-info-600",
  gray: "bg-gray-100 text-gray-600",
  primary: "bg-primary-50 text-primary-600",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

const tournamentStatusMeta: Record<TournamentStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "gray" },
  REGISTRATION_OPEN: { label: "Open", tone: "success" },
  REGISTRATION_CLOSED: { label: "Upcoming", tone: "warning" },
  READY: { label: "Ready", tone: "warning" },
  LIVE: { label: "Live", tone: "success" },
  RESULTS_PENDING: { label: "Results pending", tone: "info" },
  RESULTS_REVIEW: { label: "Under review", tone: "info" },
  RESULTS_PUBLISHED: { label: "Completed", tone: "gray" },
  COMPLETED: { label: "Completed", tone: "gray" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const meta = tournamentStatusMeta[status];
  return (
    <Badge tone={meta.tone}>
      {status === "LIVE" ? (
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" />
      ) : null}
      {meta.label.toUpperCase()}
    </Badge>
  );
}

const registrationStatusMeta: Record<RegistrationStatus, { label: string; tone: Tone }> = {
  RESERVED: { label: "Reserved", tone: "warning" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  DISQUALIFIED: { label: "Disqualified", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "gray" },
};

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  const meta = registrationStatusMeta[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const paymentStatusMeta: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "info" },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = paymentStatusMeta[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const prizeStatusMeta: Record<PrizeStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending payout", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
};

export function PrizeStatusBadge({ status }: { status: PrizeStatus }) {
  const meta = prizeStatusMeta[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
