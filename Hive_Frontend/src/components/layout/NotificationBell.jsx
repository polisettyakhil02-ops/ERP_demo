import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { notificationApi } from "@/api/api";
import { ACTIONABLE_TYPES } from "@/lib/notificationActionTypes";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

// GET /api/notifications returns whatever matches this user's role+branch
// (single-branch roles like principal/accounts_manager) unioned with
// anything addressed to them directly by user id (used for multi-branch
// roles like admin_officer, e.g. the "retry this transfer" loop-back) -
// see notificationController.list.
export default function NotificationBell({ user }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);

  const viewAll = () => {
    setOpen(false);
    navigate("/notifications");
  };

  const load = useCallback(() => {
    if (!user?._id) return;
    notificationApi
      .list()
      .then(setItems)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const markDone = async (id) => {
    setResolvingId(id);
    try {
      await notificationApi.resolve(id);
      setItems((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setResolvingId(null);
    }
  };

  // Actionable alerts (deletion/cancellation/change requests - see
  // ACTIONABLE_TYPES) act on the underlying record directly via its own
  // approve/reject endpoints, rather than the generic "Mark done" -
  // approving/rejecting already resolves the notification server-side, so
  // it's removed from the list the same way markDone removes it, just via a
  // different call. Every other type (e.g. staff_transfer_reassignment,
  // *_result alerts) has no decision of its own and stays on "Mark done".
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
      toast.success(
        decision === "Approved" ? `${config.label} approved` : `${config.label} rejected`,
      );
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100">
          <Bell className="w-4 h-4" />
          {items.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="end">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No open notifications
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((n) => (
              <div
                key={n._id}
                className="border-b border-slate-100 pb-2 last:border-0"
              >
                <p className="text-sm font-medium text-slate-800">
                  {n.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                {ACTIONABLE_TYPES[n.type] &&
                n[ACTIONABLE_TYPES[n.type].idField] ? (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={resolvingId === n._id}
                      onClick={() => decide(n, "Approved")}
                    >
                      {resolvingId === n._id ? "..." : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      disabled={resolvingId === n._id}
                      onClick={() => decide(n, "Rejected")}
                    >
                      {resolvingId === n._id ? "..." : "Reject"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1.5 h-7 text-xs"
                    disabled={resolvingId === n._id}
                    onClick={() => markDone(n._id)}
                  >
                    {resolvingId === n._id ? "Marking..." : "Mark done"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="w-full h-8 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 mt-1"
          onClick={viewAll}
        >
          View more
        </Button>
      </PopoverContent>
    </Popover>
  );
}
