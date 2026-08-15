import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Pagination } from "@/api/client";

interface PageControlsProps {
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
}

export function PageControls({ pagination, onPageChange }: PageControlsProps) {
  if (!pagination || pagination.total <= pagination.page_size) return null;

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.page_size));

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
      <p className="text-xs text-gray-400">
        Page {pagination.page} of {totalPages} · {pagination.total} total
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          <ChevronLeft size={14} /> Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pagination.page >= totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
