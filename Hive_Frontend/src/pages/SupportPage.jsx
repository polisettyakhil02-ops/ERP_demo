import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ticketApi } from "@/api/api";
import PageHeader from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paperclip, X, LifeBuoy, Clock, Inbox } from "lucide-react";

const TICKET_TYPES = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "New Feature" },
  { value: "improvement", label: "Improvement" },
];

const TYPE_LABELS = TICKET_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {}
);

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const STATUS_STYLES = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

const apiErrorMessage = (err) =>
  err?.response?.data?.message || err?.message || "Something went wrong";

const ticketRef = (id) => `TCK-${String(id).slice(-6).toUpperCase()}`;

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export default function SupportPage() {
  const [type, setType] = useState("");
  const [page, setPage] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketPage, setTicketPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const loadTickets = async (pageNum = ticketPage) => {
    setLoadingTickets(true);
    try {
      const res = await ticketApi.listMine({ page: pageNum, limit: pageSize });
      setTickets(res.data);
      setTotalPages(res.meta?.totalPages ?? 1);
      setTotalCount(res.meta?.total ?? res.data.length);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    loadTickets(ticketPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketPage]);

  const resetForm = () => {
    setType("");
    setPage("");
    setDescription("");
    setImage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!type || !page.trim() || !description.trim()) {
      toast.error("Please select a type, the page, and describe the issue.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await ticketApi.create({
        type,
        page: page.trim(),
        description: description.trim(),
        image,
      });
      toast.success(
        `Ticket ${ticketRef(created._id)} raised — we'll respond within 24 hours.`
      );
      if (ticketPage === 1) {
        loadTickets(1);
      } else {
        setTicketPage(1);
      }
      resetForm();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <PageHeader
          title="Contact Support"
          subtitle="Raise a ticket for a bug, a new feature, or an improvement — our team will follow up by email."
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 space-y-4"
      >
        <div>
          <Label className="text-xs mb-1 block">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="What kind of ticket is this?" />
            </SelectTrigger>
            <SelectContent>
              {TICKET_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs mb-1 block">Page</Label>
          <Input
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder="Which page is this about? e.g. Fee Receipts, Student List"
          />
        </div>

        <div>
          <Label className="text-xs mb-1 block">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue or feature in detail..."
            rows={6}
          />
        </div>

        <div>
          <Label className="text-xs mb-1 block">Screenshot (optional)</Label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <Paperclip className="w-3.5 h-3.5" />
              {image ? image.name : "Attach image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
              />
            </label>
            {image && (
              <button type="button" onClick={() => setImage(null)}>
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            Expected response time: within 24 hours
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="gap-1.5 rounded-xl shrink-0"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            {submitting ? "Raising ticket..." : "Raise Ticket"}
          </Button>
        </div>
      </form>

      <div className="w-full max-w-2xl mt-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Your Tickets
        </h2>

        {loadingTickets ? (
          <div className="text-xs text-slate-400 px-1">Loading tickets…</div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
            <Inbox className="w-6 h-6" />
            <p className="text-xs">You haven't raised any tickets yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div
                key={t._id}
                className="bg-white rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-slate-400">
                        #{ticketRef(t._id)}
                      </span>
                      <span className="text-xs font-medium text-slate-600">
                        {TYPE_LABELS[t.type] || t.type}
                      </span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500 truncate">
                        {t.page}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1.5 line-clamp-2">
                      {t.description}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_STYLES[t.status] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Submitted {formatDate(t.created_date)}
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-400">
                  Page {ticketPage} of {totalPages} · {totalCount} ticket
                  {totalCount !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ticketPage <= 1 || loadingTickets}
                    onClick={() => setTicketPage((p) => Math.max(p - 1, 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ticketPage >= totalPages || loadingTickets}
                    onClick={() =>
                      setTicketPage((p) => Math.min(p + 1, totalPages))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
