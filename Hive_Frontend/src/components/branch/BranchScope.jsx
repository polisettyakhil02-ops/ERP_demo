// components/branch/BranchScope.jsx
//
// Branch-first navigation for the Admin Officer.
//
// An admin_officer is one of only two MULTI_BRANCH_ROLES (see
// backend/src/config/constants.js), so pages like Staff / Bus Routes / Fee
// Structure used to open straight onto one table mixing every branch
// together, with a small dropdown to narrow it. That buries the question
// they actually have ("what does THIS branch look like, and which one have
// I not set up yet?") under a merged list.
//
// This module turns those pages into two levels:
//   1. a grid of branch cards, each carrying that page's own headline
//      number, plus an "All branches combined" card for the genuinely
//      cross-branch jobs (finding a staff member whose branch you forget);
//   2. the page exactly as it was, scoped to the branch that was clicked,
//      with a scope bar on top to go back or switch.
//
// Every other role is single-branch and already sees only their own data,
// so all of this is gated on one `enabled` flag that lives in
// useBranchScope alone - when it is false the hook fetches nothing and the
// components render nothing, which keeps "did we change the Principal's
// page?" a one-file question instead of a three-file one.
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { branchApi } from "@/api/api";
import { toast } from "sonner";
import {
  Building2,
  ChevronRight,
  LayoutGrid,
  AlertTriangle,
  ArrowLeft,
  Search,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

// The sentinel the `branch` search param carries for the "All branches
// combined" card. A real branch id is a 24-char ObjectId, so this can
// never collide with one.
export const ALL_BRANCHES = "all";

/**
 * Owns which branch the page is currently scoped to.
 *
 * The value lives in the URL (`?branch=<id>`), not component state, for
 * three reasons that all matter here: refreshing keeps you on the branch
 * you were working in, the browser Back button already means "back to the
 * branch cards" without any extra wiring, and a branch view can be linked
 * to directly from elsewhere later.
 *
 * Returns `{ enabled: false }` and does nothing at all when disabled, so a
 * caller can hold the hook unconditionally (Rules of Hooks) while still
 * leaving every other role's page untouched.
 */
export function useBranchScope({ enabled }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(enabled);

  // GET /api/branches is already restricted server-side to the branches
  // this user is actually assigned to (branchController.js keys off
  // User.branches), so whatever comes back can be shown as-is.
  useEffect(() => {
    if (!enabled) {
      setBranches([]);
      setLoadingBranches(false);
      return;
    }
    let cancelled = false;
    setLoadingBranches(true);
    branchApi
      .list()
      .then((data) => {
        if (!cancelled) setBranches(data || []);
      })
      .catch((err) => {
        if (!cancelled) toast.error("Failed to load branches", { description: apiErrorMessage(err) });
      })
      .finally(() => {
        if (!cancelled) setLoadingBranches(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const rawParam = enabled ? searchParams.get("branch") : null;

  // A branch id in the URL that isn't one of this user's own branches is
  // treated as "nothing selected" rather than passed to the server - it
  // would only earn a 403 (the list endpoints validate it too), and
  // dropping back to the cards is the more useful outcome for a stale
  // bookmark. Not applied until the branch list has actually loaded,
  // otherwise a valid id would be discarded on first render.
  const branchId = useMemo(() => {
    if (!rawParam) return null;
    if (rawParam === ALL_BRANCHES) return ALL_BRANCHES;
    if (loadingBranches) return rawParam;
    return branches.some((b) => b._id === rawParam) ? rawParam : null;
  }, [rawParam, branches, loadingBranches]);

  const branch = useMemo(
    () =>
      branchId && branchId !== ALL_BRANCHES
        ? branches.find((b) => b._id === branchId) || null
        : null,
    [branchId, branches],
  );

  // `replace: true` is deliberately NOT used: each branch the user opens
  // should be its own history entry, so Back walks them out to the cards.
  const setBranchId = (next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next) params.set("branch", next);
      else params.delete("branch");
      return params;
    });
  };

  return {
    enabled: !!enabled,
    branches,
    loadingBranches,
    branchId,
    branch,
    isAllBranches: branchId === ALL_BRANCHES,
    // True exactly when the cards should be shown instead of the page.
    showPicker: !!enabled && !branchId,
    setBranchId,
    clear: () => setBranchId(null),
    // The value to send as the API's `branch` param: undefined for "all"
    // (the server then returns every branch this user is assigned to) and
    // for the disabled case, where the server scopes by the account itself.
    apiBranchParam:
      enabled && branchId && branchId !== ALL_BRANCHES ? branchId : undefined,
  };
}

function BranchCard({ branch, metric, onSelect }) {
  const { primary, primaryLabel, secondary, warn } = metric || {};
  return (
    <button
      type="button"
      onClick={() => onSelect(branch._id)}
      className="group text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-400 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
          <Building2 className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-800 truncate">{branch.name}</p>
          <p className="text-xs text-slate-400 truncate">
            {branch.code}
            {branch.schoolName ? ` · ${branch.schoolName}` : ""}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 shrink-0 mt-1 transition-colors" />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-800 tracking-tight leading-none">
            {primary}
          </p>
          {primaryLabel && (
            <p className="text-xs text-slate-500 mt-1.5">{primaryLabel}</p>
          )}
        </div>
        {secondary && !warn && (
          <p className="text-xs text-slate-400 text-right shrink-0">{secondary}</p>
        )}
      </div>

      {warn && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{warn}</span>
        </div>
      )}
    </button>
  );
}

/**
 * The landing screen: one card per branch, plus a combined view.
 *
 * `metricFor(branchId)` returns { primary, primaryLabel, secondary, warn }
 * - each page decides its own headline number, since "what matters about
 * this branch" is different for staff, routes and fee structures.
 * `allMetric` is the same shape for the combined card.
 *
 * Branches with nothing set up are deliberately still listed (with their
 * zero and a `warn`): "which branch have I not configured yet?" is a
 * question this screen should answer, not hide.
 */
// Above this many branches the grid stops being scannable at a glance and
// gets a filter box. Deliberately a filter and not pagination: this screen
// exists so an admin can spot the branch that still needs setting up, and
// paging would hide exactly the card they came to find behind a click.
const SEARCH_THRESHOLD = 8;

export function BranchPickerScreen({
  title,
  subtitle,
  branches,
  loading,
  metricFor,
  allMetric,
  onSelect,
  headerSlot,
  allLabel = "All branches combined",
}) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(
      (b) =>
        (b.name || "").toLowerCase().includes(q) ||
        (b.code || "").toLowerCase().includes(q) ||
        (b.schoolName || "").toLowerCase().includes(q),
    );
  }, [branches, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {headerSlot}
      </div>

      {!loading && branches.length > SEARCH_THRESHOLD && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Filter branches by name or code..."
            className="pl-9 bg-white"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl p-5 h-[150px] animate-pulse"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 mb-4" />
              <div className="h-3 w-2/3 bg-slate-100 rounded mb-2" />
              <div className="h-6 w-1/3 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : branches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">
            No branches assigned to your account.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Ask a super admin to assign you a branch, then reload this page.
          </p>
        </div>
      ) : (
        <>
          {shown.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-500">
                No branch matches "{query}".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shown.map((b) => (
                <BranchCard
                  key={b._id}
                  branch={b}
                  metric={metricFor?.(b._id)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}

          {branches.length > 1 && (
            <button
              type="button"
              onClick={() => onSelect(ALL_BRANCHES)}
              className="group w-full text-left bg-white border border-dashed border-slate-300 rounded-xl p-4 flex items-center gap-3 hover:border-indigo-400 hover:bg-slate-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <LayoutGrid className="w-4.5 h-4.5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">{allLabel}</p>
                {allMetric?.primaryLabel && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {allMetric.primary} {allMetric.primaryLabel} ·{" "}
                    {branches.length} branches
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 shrink-0" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The bar that sits above the scoped page: where you are, a way back to
 * the cards, and a switcher so moving between branches doesn't mean going
 * back first.
 */
export function BranchScopeBar({ branch, branches, isAllBranches, onChange, onBack }) {
  // A searchable combobox rather than a <Select>: branch names are long
  // enough to truncate in a fixed-width trigger, and an admin on a group
  // with a dozen branches should be able to type two letters instead of
  // scrolling. Same Popover + Command pattern the student picker on
  // Transfers and the category picker on BPExpenditure use.
  const [open, setOpen] = useState(false);

  const current = isAllBranches
    ? "All branches combined"
    : branch
      ? `${branch.name} (${branch.code})`
      : "Switch branch";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All branches
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
        <span className="inline-flex items-center gap-1.5 min-w-0">
          {isAllBranches ? (
            <>
              <LayoutGrid className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm font-semibold text-slate-800 truncate">
                All branches combined
              </span>
            </>
          ) : (
            <>
              <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-sm font-semibold text-slate-800 truncate">
                {branch?.name}
              </span>
              {branch?.code && (
                <span className="text-xs text-slate-400 shrink-0">({branch.code})</span>
              )}
            </>
          )}
        </span>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[230px] h-9 justify-between text-sm font-normal shrink-0 bg-white"
          >
            <span className="truncate">{current}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Search branch..." />
            <CommandList>
              <CommandEmpty>No branch found.</CommandEmpty>
              <CommandGroup>
                {branches.map((b) => {
                  const label = `${b.name} (${b.code})`;
                  return (
                    <CommandItem
                      key={b._id}
                      // cmdk filters on `value`, so it has to be the
                      // searchable text - the id comes from the closure.
                      value={label}
                      onSelect={() => {
                        onChange(b._id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          !isAllBranches && branch?._id === b._id
                            ? "opacity-100"
                            : "opacity-0"
                        }`}
                      />
                      <span className="truncate">{label}</span>
                    </CommandItem>
                  );
                })}
                {branches.length > 1 && (
                  <CommandItem
                    value="All branches combined"
                    onSelect={() => {
                      onChange(ALL_BRANCHES);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${isAllBranches ? "opacity-100" : "opacity-0"}`}
                    />
                    All branches combined
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
