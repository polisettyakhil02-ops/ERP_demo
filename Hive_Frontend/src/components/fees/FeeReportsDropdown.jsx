import React from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, ChevronDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FEE_REPORT_CATEGORIES } from "@/lib/feeReportCategories";

// Rendered on the main Student Fee Report page, on every one of the 10
// category report pages (CategoryFeeReport.jsx), and on the Pending Dues
// report - `activeKey` highlights whichever report is currently open
// (undefined/null on the main page).
export default function FeeReportsDropdown({ activeKey }) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5" /> Reports
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Fee reports</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate("/student-fee-report")}
          className={!activeKey ? "font-semibold text-indigo-600" : ""}
        >
          All Students (Full Report)
        </DropdownMenuItem>
        {/* Not one of FEE_REPORT_CATEGORIES - those map 1:1 onto the
            backend's ?category= values and share one generic page, whereas
            this has its own endpoint, columns and filters. Pinned directly
            under the full report because it is the one accounts staff reach
            for daily. */}
        <DropdownMenuItem
          onSelect={() => navigate("/student-fee-report/pending-dues")}
          className={`gap-2 ${activeKey === "pending_dues" ? "font-semibold text-indigo-600" : ""}`}
        >
          <AlertCircle className="w-4 h-4 text-red-500" /> Pending Dues
          (Student-wise)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {FEE_REPORT_CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <DropdownMenuItem
              key={c.key}
              onSelect={() => navigate(c.path)}
              className={`gap-2 ${activeKey === c.key ? "font-semibold text-indigo-600" : ""}`}
            >
              <Icon className="w-4 h-4 text-slate-500" /> {c.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
