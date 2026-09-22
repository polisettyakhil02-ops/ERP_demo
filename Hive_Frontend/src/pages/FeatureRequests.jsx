import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCopy, Inbox, MessageSquare, Sparkles } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { featureRequestApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_LABELS } from "@/lib/roleLabels";
import FeatureDraftDetails from "@/components/ai/FeatureDraftDetails";
import {
  FEATURE_REQUEST_STATUSES,
  PRIORITY_STYLES,
  STATUS_STYLES,
  apiErrorMessage,
  openFeatureChat,
  requestRef,
  toIssueMarkdown,
} from "@/lib/featureRequests";

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

function Badge({ className, children }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

// Super Admin only: move a request through review and reply to the
// requester (admin_notes is shown to them on this same page).
function ReviewForm({ request, onSaved }) {
  const [status, setStatus] = useState(request.status);
  const [notes, setNotes] = useState(request.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const dirty =
    status !== request.status || notes.trim() !== (request.admin_notes || "");

  const save = async () => {
    setSaving(true);
    try {
      const updated = await featureRequestApi.update(request._id, {
        status,
        admin_notes: notes,
      });
      onSaved(updated);
      toast.success("Request updated");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const copyAsIssue = async () => {
    try {
      await navigator.clipboard.writeText(toIssueMarkdown(request));
      toast.success("Copied - paste it into a new GitHub issue");
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-600">Review</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEATURE_REQUEST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={copyAsIssue}
          className="gap-1.5 bg-white"
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          Copy as GitHub issue
        </Button>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Reply to the requester (they will see this)"
        className="bg-white"
      />
      <Button size="sm" onClick={save} disabled={!dirty || saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

export default function FeatureRequests() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    featureRequestApi
      .list(statusFilter === "all" ? {} : { status: statusFilter })
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const replaceRow = (updated) =>
    setRows((prev) =>
      prev.map((r) =>
        r._id === updated._id ? { ...r, ...updated, branch: r.branch } : r,
      ),
    );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Feature Requests"
        subtitle={
          isSuperAdmin
            ? "Ideas staff worked out with the AI assistant. Review them and keep each requester updated."
            : "Ideas you've submitted to the development team and where they stand."
        }
        action={
          <Button onClick={openFeatureChat} className="gap-1.5 rounded-xl">
            <Sparkles className="h-4 w-4" />
            Suggest a feature
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-slate-500">Status</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {FEATURE_REQUEST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="px-1 text-xs text-slate-400">Loading requests…</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-slate-400">
          <Inbox className="h-6 w-6" />
          <p className="text-sm">
            {statusFilter === "all"
              ? isSuperAdmin
                ? "No feature requests yet."
                : "You haven't suggested any features yet."
              : `No requests with status "${statusFilter}".`}
          </p>
          {!isSuperAdmin && statusFilter === "all" && (
            <Button
              size="sm"
              variant="outline"
              onClick={openFeatureChat}
              className="mt-1"
            >
              Suggest your first idea
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const expanded = expandedId === r._id;
            return (
              <div
                key={r._id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">
                        #{requestRef(r._id)}
                      </span>
                      <Badge
                        className={
                          PRIORITY_STYLES[r.priority] || PRIORITY_STYLES.Medium
                        }
                      >
                        {r.priority}
                      </Badge>
                    </div>
                    <p className="mt-1 font-semibold text-slate-800">
                      {r.title}
                    </p>
                  </div>
                  <Badge
                    className={
                      STATUS_STYLES[r.status] || "bg-slate-100 text-slate-600"
                    }
                  >
                    {r.status}
                  </Badge>
                </div>

                <p className="mt-1.5 text-sm text-slate-600">{r.summary}</p>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span>Submitted {formatDate(r.created_date)}</span>
                  {isSuperAdmin && (
                    <span>
                      by {r.requester_name || "—"}
                      {r.requester_role
                        ? ` · ${ROLE_LABELS[r.requester_role] || r.requester_role}`
                        : ""}
                      {r.branch?.name ? ` · ${r.branch.name}` : ""}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : r._id)}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    {expanded ? "Hide details" : "Show details"}
                  </button>
                </div>

                {!isSuperAdmin && r.admin_notes && (
                  <div className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                    <p className="text-xs font-semibold text-indigo-600">
                      Reply from the team
                    </p>
                    <p className="mt-0.5 whitespace-pre-line">
                      {r.admin_notes}
                    </p>
                  </div>
                )}

                {expanded && (
                  <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                    <FeatureDraftDetails draft={r} />

                    {r.conversation?.length > 0 && (
                      <details>
                        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-500">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Chat with the assistant ({r.conversation.length}{" "}
                          messages)
                        </summary>
                        <div className="mt-2 space-y-2">
                          {r.conversation.map((m, i) => (
                            <div
                              key={i}
                              className={`whitespace-pre-line rounded-xl px-3 py-2 text-sm ${
                                m.role === "user"
                                  ? "ml-8 bg-indigo-50 text-indigo-900"
                                  : "mr-8 bg-slate-100 text-slate-700"
                              }`}
                            >
                              {m.content}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {isSuperAdmin && (
                      <ReviewForm request={r} onSaved={replaceRow} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
