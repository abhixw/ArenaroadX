import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-gray-100", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="card p-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="mt-4 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <Skeleton className="mt-4 h-9 w-full rounded-xl" />
    </div>
  );
}
