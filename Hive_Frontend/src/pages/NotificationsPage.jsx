import React, { useEffect, useState } from "react";
import { notificationApi, branchApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { ACTIONABLE_TYPES } from "@/lib/notificationActionTypes";
import { Bell, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

// Tabs for the Notifications page, keyed to match notificationController.js
// list()'s `category` query param exactly (server-side filtered, so
// pagination/counts stay correct per tab).
//
// No Income tab: the Income page is commented out of NAV_BY_ROLE
// (RoleLayout.jsx), so the tab could only ever be empty. The old catch-all
// "Other" tab is now "Concessions" and filters on concession_* properly -
// back-date requests, the only other type it used to hold, moved under Fee
// Receipts, where they are raised from (AddPaymentDialog.jsx).
const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "fee_receipts", label: "Fee Receipts" },
  { key: "students", label: "Students" },
  { key: "staff", label: "Staff" },
  { key: "expenditure", label: "Expenditure" },
  { key: "concessions", label: "Concessions" },
];

// Full-page counterpart to NotificationBell.jsx's popover, which only ever
// shows the newest 100 Open items with no pagination. This page hits the
// same GET /api/notifications endpoint (now with page/limit/status/branch
// support - see notificationController.list), so the same Approve/Reject/
// Mark done actions and the same addressing rules apply, just paginated and
// filterable by branch/status instead of capped at 100.
export default function NotificationsPage() {
  const { user } = useAuth();
  const isMultiBranch = user?.role === "admin_officer";

  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [category, setCategory] = useState("all");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!isMultiBranch) return;
    branchApi
      .list()
      .then((data) => setBranches(data || []))
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, [isMultiBranch]);

  const resolvedBranchId =
    isMultiBranch && selectedBranch !== "all" ? selectedBranch : undefined;

  const load = ({ background = false } = {}) => {
    if (!background) setLoading(true);
    notificationApi
      .listPaged({
        branch: resolvedBranchId,
        status: statusFilter,
        category,
        page,
        limit: pageSize,
      })
      .then((res) => {
        setItems(res?.data || []);
        setTotalCount(res?.meta?.total ?? res?.data?.length ?? 0);
        setTotalPages(res?.meta?.totalPages ?? 1);
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => {
        if (!background) setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => load({ background: true }), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedBranchId, statusFilter, category, page, pageSize]);

  const applyCategory = (v) => {
    setCategory(v);
    setPage(1);
  };

  const applyStatusFilter = (v) => {
    setStatusFilter(v);
    setPage(1);
  };
  const applyBranchFilter = (v) => {
    setSelectedBranch(v);
    setPage(1);
  };
  const applyPageSize = (v) => {
    setPageSize(Number(v));
    setPage(1);
  };

  const markDone = async (id) => {
    setResolvingId(id);
    try {
      await notificationApi.resolve(id);
      setItems((prev) => prev.filter((n) => n._id !== id));
      setTotalCount((c) => Math.max(c - 1, 0));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setResolvingId(null);
    }
  };

  // Acts on the real underlying record (BackDateRequest / Student / User),
  // never on the notification directly - every approve/reject endpoint
  // already resolves the notification server-side as a side effect, same
  // as NotificationBell.jsx's original back_date_request-only handling.
  const decide = async (notification, decision) => {
    const config = ACTIONABLE_TYPES[notification.type];
    if (!config) return;
    const recordId = notification[config.idField];
    setResolvingId(notification._id);
    try {
      if (decision === "Approved") {
        await config.approve(recordId);
      } else {
        await config.reject(recordId);
      }
      setItems((prev) => prev.filter((n) => n._id !== notification._id));
      setTotalCount((c) => Math.max(c - 1, 0));
      setReviewTarget(null);
      toast.success(
        decision === "Approved"
          ? `${config.label} approved`
          : `${config.label} rejected`,
      );
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-500" /> Notifications
          </h2>
          <p className="text-sm text-slate-500">
            All requests and alerts addressed to you
          </p>
        </div>
      </div>

      <Tabs value={category} onValueChange={applyCategory}>
        <TabsList>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-3 items-center">
        {isMultiBranch && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" />
            <Select value={selectedBranch} onValueChange={applyBranchFilter}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b._id} value={b._id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Select value={statusFilter} onValueChange={applyStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="All">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading && items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            No notifications found.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((n) => (
              <div
                key={n._id}
                className="p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">
                      {n.title}
                    </p>
                    {n.status === "Resolved" && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {n.created_date
                      ? new Date(n.created_date).toLocaleString("en-IN")
                      : ""}
                  </p>
                </div>
                {n.status === "Open" &&
                  (ACTIONABLE_TYPES[n.type] &&
                  n[ACTIONABLE_TYPES[n.type].idField] ? (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex-shrink-0"
                      onClick={() => setReviewTarget(n)}
                    >
                      Review
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-shrink-0"
                      disabled={resolvingId === n._id}
                      onClick={() => markDone(n._id)}
                    >
                      {resolvingId === n._id ? "Marking..." : "Mark done"}
                    </Button>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Select value={String(pageSize)} onValueChange={applyPageSize}>
            <SelectTrigger className="w-28 h-9 text-sm">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-slate-500">
            Page {page} of {totalPages} · {totalCount.toLocaleString("en-IN")}{" "}
            record{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={!!reviewTarget}
        onOpenChange={(open) => !open && setReviewTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewTarget?.title}</DialogTitle>
            <DialogDescription>{reviewTarget?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={resolvingId === reviewTarget?._id}
              onClick={() => setReviewTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={resolvingId === reviewTarget?._id}
              onClick={() => decide(reviewTarget, "Rejected")}
            >
              {resolvingId === reviewTarget?._id ? "..." : "Reject"}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={resolvingId === reviewTarget?._id}
              onClick={() => decide(reviewTarget, "Approved")}
            >
              {resolvingId === reviewTarget?._id ? "..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
