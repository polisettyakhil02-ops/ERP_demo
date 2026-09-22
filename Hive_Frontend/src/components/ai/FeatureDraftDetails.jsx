import React from "react";

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <div className="mt-1 text-sm text-slate-700">{children}</div>
    </div>
  );
}

function List({ items, empty = "None given" }) {
  if (!items?.length) return <p className="text-slate-400">{empty}</p>;
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

// The body of a feature request / draft - shared by the chat panel's draft
// card and the Feature Requests page.
export default function FeatureDraftDetails({ draft }) {
  return (
    <div className="space-y-3">
      {draft.problem && (
        <Section title="Problem today">
          <p className="whitespace-pre-line">{draft.problem}</p>
        </Section>
      )}
      {draft.proposed_solution && (
        <Section title="How it would work">
          <p className="whitespace-pre-line">{draft.proposed_solution}</p>
        </Section>
      )}
      <Section title="User stories">
        <List items={draft.user_stories} />
      </Section>
      <Section title="Done when">
        <List items={draft.acceptance_criteria} />
      </Section>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Section title="Roles">
          {(draft.affected_roles || []).join(", ") || "—"}
        </Section>
        <Section title="Areas of the ERP">
          {(draft.affected_modules || []).join(", ") || "—"}
        </Section>
      </div>
    </div>
  );
}
