// Shared bits for "Suggest a feature" - the chat panel
// (components/ai/FeatureChat.jsx) and the Feature Requests page.

// Dispatch on window to open the chat panel from anywhere, e.g. the
// Feature Requests page's "Suggest a feature" button.
export const OPEN_FEATURE_CHAT_EVENT = "mm:open-feature-chat";

export const openFeatureChat = () =>
  window.dispatchEvent(new CustomEvent(OPEN_FEATURE_CHAT_EVENT));

export const FEATURE_REQUEST_STATUSES = [
  "Submitted",
  "Under Review",
  "Planned",
  "In Progress",
  "Done",
  "Declined",
];

export const STATUS_STYLES = {
  Submitted: "bg-slate-100 text-slate-700",
  "Under Review": "bg-amber-100 text-amber-700",
  Planned: "bg-indigo-100 text-indigo-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Done: "bg-emerald-100 text-emerald-700",
  Declined: "bg-rose-100 text-rose-700",
};

export const PRIORITY_STYLES = {
  Low: "bg-slate-100 text-slate-600",
  Medium: "bg-amber-50 text-amber-700",
  High: "bg-rose-50 text-rose-700",
};

// Backend errors come as { error } (ApiError) or { message }.
export const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

export const requestRef = (id) => `FR-${String(id).slice(-6).toUpperCase()}`;

const bullets = (items) =>
  items?.length ? items.map((i) => `- ${i}`).join("\n") : "_None given_";

// Markdown for pasting into a GitHub issue (or any tracker).
export function toIssueMarkdown(req) {
  const requester = [req.requester_name, req.requester_role, req.branch?.name]
    .filter(Boolean)
    .join(", ");
  return [
    `## Summary`,
    req.summary,
    ``,
    `## Problem today`,
    req.problem || "_Not given_",
    ``,
    `## Proposed solution`,
    req.proposed_solution || "_Not given_",
    ``,
    `## User stories`,
    bullets(req.user_stories),
    ``,
    `## Acceptance criteria`,
    (req.acceptance_criteria || []).length
      ? req.acceptance_criteria.map((c) => `- [ ] ${c}`).join("\n")
      : "_None given_",
    ``,
    `## Details`,
    `- Priority: ${req.priority}`,
    `- Roles: ${(req.affected_roles || []).join(", ") || "-"}`,
    `- Modules: ${(req.affected_modules || []).join(", ") || "-"}`,
    `- Requested by: ${requester || "-"}`,
    `- Reference: ${requestRef(req._id)}`,
  ].join("\n");
}
