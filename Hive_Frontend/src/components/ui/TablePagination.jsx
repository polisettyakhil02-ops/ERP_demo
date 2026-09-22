// components/ui/TablePagination.jsx
//
// The footer bar under a paginated table: how many rows are showing, a
// page-size picker, and prev/next. Lifted out of BPStaff.jsx's inline
// version so the Bus Routes and Fee Structure tables get the same control
// rather than a third hand-rolled copy.
//
// Paging is over rows already in memory - the caller slices its own array.
// That is the right level for these screens: each one fetches a single
// branch (or, on "All branches combined", every branch the account is
// assigned to), which is bounded master data, so a round-trip per page
// would cost more than it saves.
//
// The whole bar hides when everything fits on one page, so a table with
// nine rows doesn't carry controls that can't do anything. Pass
// `alwaysShow` where that would be a behaviour change.
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  options = PAGE_SIZE_OPTIONS,
  alwaysShow = false,
  noun = "rows",
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (!alwaysShow && total <= pageSize) return null;

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>
          {total === 0
            ? `0 ${noun}`
            : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            onPageSizeChange(Number(v));
            onPageChange(1);
          }}
        >
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </Button>
        <span className="text-xs text-slate-500 px-1">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
