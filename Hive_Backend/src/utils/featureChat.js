// utils/featureChat.js
//
// The AI side of "Suggest a feature": Claude interviews a staff member about
// an idea and, once it understands it, returns a structured draft through
// the submit_feature_draft tool. The tool is never "executed" - its input IS
// the draft, which goes back to the browser for the user to review and
// submit (featureRequestController.create). The model has no access to ERP
// data and nothing it returns changes the app.
//
// Needs ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) in the environment;
// without it the chat endpoint answers 503 and the rest of the app is
// unaffected.

import Anthropic from "@anthropic-ai/sdk";
import { FEATURE_REQUEST_PRIORITIES } from "../models/FeatureRequest.js";

export const FEATURE_CHAT_MODEL =
  process.env.FEATURE_CHAT_MODEL || "claude-opus-5";

export const REQUESTER_ROLE_LABELS = {
  super_admin: "Super Admin",
  admin_officer: "Admin Officer",
  principal: "Principal",
  accounts_manager: "Accounts Manager",
  teacher: "Teacher",
};

const ROLE_LABEL_VALUES = Object.values(REQUESTER_ROLE_LABELS);

export function isFeatureChatConfigured() {
  return Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  );
}

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

const SYSTEM_PROMPT = `You help staff of a school ERP (MasterMinds ERP) turn an idea for a new feature or an improvement into a clear request for the development team.

About the ERP: it is used by a group of schools with many branches. Staff roles and what they use today:
- Super Admin: manages schools and branches.
- Admin Officer (works across several branches): fee receipts, student fee reports, staff, students, expenditure, financial report, accounts, branches, fee structure, concessions, bus routes, notifications.
- Principal (one branch): staff, classes, subjects, students, marks, report cards, analytics, notifications.
- Accounts Manager (one branch): admissions (enquiry, sale of application, admission form), staff, students, hall tickets, subjects, fee receipts (single and multiple), concessions, receipt cancellation requests, student fee report, expenditure, financial report, transfers, contact support.
- Teacher (one branch): students, classes, attendance, marks, homework, hall tickets, report cards, analytics.
Each user only sees their own branch's data (Admin Officers see the branches assigned to them). Sensitive changes go through approvals, for example fee receipt cancellations and staff deactivations.

How to help:
- Ask short questions, one or two at a time, to learn what problem they have today, who would use the feature, what it should do step by step, and how they would know it works. Offer concrete options when they are unsure.
- If what they describe already exists in the ERP, tell them where to find it instead of drafting a request.
- Keep every reply short and plain: a few sentences in simple words, no headings. Many users are not technical.
- Reply in the language the user writes in, but write the draft in English so the development team can read it.
- Do not ask for or repeat personal details about students, parents or staff (names, phone numbers, amounts owed). If the user shares some, leave them out of the draft.
- You cannot change the ERP or promise when anything will be built. The development team reviews every request.
- Stay on this task. If asked for something unrelated, say briefly that you can only help with ideas for the ERP.

When you understand the request well enough for a developer to build it, call submit_feature_draft with a complete draft, with one brief sentence before it. The user reviews the draft and may ask for changes; when they do, call submit_feature_draft again with the full updated draft.`;

const DRAFT_TOOL = {
  name: "submit_feature_draft",
  description:
    "Show the user a draft feature request to review. Call it once you understand the request well enough for a developer to build it, and again with the full updated draft whenever the user asks for changes. The user decides whether to submit it.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Short name for the feature, under 10 words.",
      },
      summary: {
        type: "string",
        description: "Two or three sentences: what the feature does and why.",
      },
      problem: {
        type: "string",
        description: "What the requester struggles with today.",
      },
      proposed_solution: {
        type: "string",
        description:
          "How the feature should work, step by step, in plain language.",
      },
      user_stories: {
        type: "array",
        items: { type: "string" },
        description: "Each in the form: As a <role>, I want <goal> so that <benefit>.",
      },
      acceptance_criteria: {
        type: "array",
        items: { type: "string" },
        description: "Checkable statements that must be true when it is done.",
      },
      affected_roles: {
        type: "array",
        items: { type: "string", enum: ROLE_LABEL_VALUES },
        description: "Which roles would use or be affected by the feature.",
      },
      affected_modules: {
        type: "array",
        items: { type: "string" },
        description:
          "Existing ERP areas this touches, e.g. Fee Receipts, Attendance.",
      },
      priority: {
        type: "string",
        enum: FEATURE_REQUEST_PRIORITIES,
        description: "How urgent the requester says this is.",
      },
    },
    required: [
      "title",
      "summary",
      "problem",
      "proposed_solution",
      "user_stories",
      "acceptance_criteria",
      "affected_roles",
      "affected_modules",
      "priority",
    ],
    additionalProperties: false,
  },
};

const LIMITS = {
  title: 150,
  summary: 2000,
  problem: 4000,
  proposed_solution: 6000,
  listItem: 500,
  listLength: 20,
};

const cleanString = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const cleanList = (value, allowed) =>
  (Array.isArray(value) ? value : [])
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => v.trim().slice(0, LIMITS.listItem))
    .filter((v) => !allowed || allowed.includes(v))
    .slice(0, LIMITS.listLength);

// Coerces a draft - from the model, or echoed back by the browser - into
// the stored shape. Returns null when it lacks a title or summary.
export function normalizeDraft(draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null;
  const normalized = {
    title: cleanString(draft.title, LIMITS.title),
    summary: cleanString(draft.summary, LIMITS.summary),
    problem: cleanString(draft.problem, LIMITS.problem),
    proposed_solution: cleanString(
      draft.proposed_solution,
      LIMITS.proposed_solution,
    ),
    user_stories: cleanList(draft.user_stories),
    acceptance_criteria: cleanList(draft.acceptance_criteria),
    affected_roles: cleanList(draft.affected_roles, ROLE_LABEL_VALUES),
    affected_modules: cleanList(draft.affected_modules),
    priority: FEATURE_REQUEST_PRIORITIES.includes(draft.priority)
      ? draft.priority
      : "Medium",
  };
  if (!normalized.title || !normalized.summary) return null;
  return normalized;
}

// The browser keeps the chat as plain { role, content, draft? } turns. A
// draft the assistant showed earlier is replayed as text so Claude can
// revise it when the user asks for changes.
function toApiMessages(history) {
  return history.map((m) => {
    if (m.role === "assistant" && m.draft) {
      return {
        role: "assistant",
        content: `${m.content}\n\n(Draft shown to the user with submit_feature_draft: ${JSON.stringify(m.draft)})`,
      };
    }
    return { role: m.role, content: m.content };
  });
}

/**
 * One chat turn. `history` is already validated (see
 * featureRequestController.chat): alternating user/assistant turns that
 * start and end with the user.
 * Resolves to { reply, draft } - draft is null until Claude proposes one.
 */
export async function runFeatureChat({ history, requesterRole }) {
  const roleLabel = REQUESTER_ROLE_LABELS[requesterRole] || "staff member";

  const response = await getClient().beta.messages.create({
    model: FEATURE_CHAT_MODEL,
    max_tokens: 16000,
    // Short interview turns - medium effort keeps replies quick without
    // hurting the draft.
    output_config: { effort: "medium" },
    // If a safety classifier declines the request, retry it server-side on
    // Anthropic's recommended fallback model instead of failing the turn.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `The person you are talking to is a ${roleLabel}.`,
      },
    ],
    tools: [DRAFT_TOOL],
    messages: toApiMessages(history),
  });

  if (response.stop_reason === "refusal") {
    return {
      reply:
        "I can't help with that one. Could you describe the feature you'd like in a different way?",
      draft: null,
    };
  }

  const reply = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === DRAFT_TOOL.name,
  );
  const draft = toolUse ? normalizeDraft(toolUse.input) : null;

  return {
    reply:
      reply ||
      (draft
        ? "Here's a draft of your request. Have a look and tell me if anything should change."
        : "Sorry, I didn't catch that. Could you tell me a bit more?"),
    draft,
  };
}
