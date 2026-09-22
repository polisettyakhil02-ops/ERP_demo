import React, { useState, useEffect, useMemo } from "react";
import { busRouteApi, branchApi } from "@/api/api";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Bus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/AuthContext";
import TablePagination from "@/components/ui/TablePagination";
import {
  useBranchScope,
  BranchPickerScreen,
  BranchScopeBar,
} from "@/components/branch/BranchScope";

const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

const EMPTY_FORM = {
  branch: "",
  route_name: "",
  route_from: "",
  route_to: "",
  stops: [""],
  fee_amount: "",
};

const rup = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function BPBusRoutes() {
  const { user } = useAuth();
  // Admin Officer is the only role that reaches this page with more than
  // one branch, so it is the only one that gets the branch-cards landing
  // screen. Every other role keeps the flat table + branch dropdown below,
  // unchanged.
  const scope = useBranchScope({ enabled: user?.role === "admin_officer" });

  const [routes, setRoutes] = useState([]);
  // Per-branch counts for the cards, from a $group aggregation - never
  // from the row list, so opening this page costs one tiny response
  // regardless of how many branches or routes exist.
  const [summary, setSummary] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Paging is only ever visible once a table runs past a page - in
  // practice that is the "All branches combined" view, where every
  // assigned branch's routes land in one list.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Legacy dropdown filter - only rendered when the branch scope is off.
  const [branchFilter, setBranchFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [confirmDeleteRow, setConfirmDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // useBranchScope already fetches the (server-scoped) branch list for
    // the roles it covers - only the others need their own copy.
    if (scope.enabled) return;
    branchApi
      .list()
      .then(setBranches)
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, [scope.enabled]);

  const branchOptions = scope.enabled ? scope.branches : branches;

  // Rows for the branch that is actually open - nothing else is fetched.
  // scope.apiBranchParam is the branch id while one is open, and undefined
  // for "All branches combined" (where the server falls back to every
  // branch this account is assigned to) and for non-scoped roles.
  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (scope.enabled) params.branch = scope.apiBranchParam;
      else if (branchFilter !== "all") params.branch = branchFilter;
      const data = await busRouteApi.list(params);
      setRoutes(data || []);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // No branch open means the cards are showing - the row list would be
    // thrown away, so don't ask for it.
    if (scope.showPicker) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter, scope.enabled, scope.branchId]);

  // Refetched every time the cards come back into view, so counts reflect
  // whatever was just added or deleted inside a branch.
  useEffect(() => {
    if (!scope.showPicker) return;
    let cancelled = false;
    busRouteApi
      .branchSummary()
      .then((data) => {
        if (!cancelled) setSummary(data || []);
      })
      .catch((err) => {
        if (!cancelled) toast.error(apiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [scope.showPicker]);

  const summaryByBranch = useMemo(
    () => Object.fromEntries((summary || []).map((r) => [String(r.branch), r])),
    [summary],
  );

  const metricFor = (branchId) => {
    const stat = summaryByBranch[String(branchId)];
    const count = stat?.total || 0;
    return {
      primary: count,
      primaryLabel: count === 1 ? "bus route" : "bus routes",
      secondary: count > 0 ? `${rup(stat.fee_total)} / year` : null,
      warn: count === 0 ? "No routes set up yet" : null,
    };
  };

  const filteredRoutes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter(
      (r) =>
        (r.route_name || "").toLowerCase().includes(q) ||
        (r.route_from || "").toLowerCase().includes(q) ||
        (r.route_to || "").toLowerCase().includes(q) ||
        (r.branch?.name || "").toLowerCase().includes(q) ||
        (r.branch?.code || "").toLowerCase().includes(q),
    );
  }, [routes, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRoutes.length / pageSize));
  // Deleting the last row of the last page, or narrowing the search, can
  // strand the viewer past the end - walk them back rather than showing an
  // empty table.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // Any change to what is being listed starts again from page one.
  useEffect(() => {
    setPage(1);
  }, [search, scope.branchId, branchFilter]);

  const pagedRoutes = filteredRoutes.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  // While one branch is open, new routes belong to it - the picker is
  // replaced by locked, pre-filled text so a route can't land in the wrong
  // branch by accident.
  const lockedBranchId =
    scope.enabled && scope.branchId && !scope.isAllBranches ? scope.branchId : null;

  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, branch: lockedBranchId || "" });
    setShowForm(true);
  };

  const openEditForm = (r) => {
    setEditingId(r._id);
    setForm({
      branch: r.branch?._id || r.branch,
      route_name: r.route_name,
      route_from: r.route_from,
      route_to: r.route_to,
      stops: r.stops && r.stops.length > 0 ? r.stops : [""],
      fee_amount: String(r.fee_amount ?? ""),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm({ ...EMPTY_FORM, branch: lockedBranchId || "" });
    setEditingId(null);
  };

  const setStop = (i, value) => {
    setForm((f) => {
      const stops = [...f.stops];
      stops[i] = value;
      return { ...f, stops };
    });
  };
  const addStop = () => setForm((f) => ({ ...f, stops: [...f.stops, ""] }));
  const removeStop = (i) =>
    setForm((f) => ({ ...f, stops: f.stops.filter((_, idx) => idx !== i) }));

  const canSave =
    form.branch &&
    form.route_name.trim() &&
    form.fee_amount !== "" &&
    Number(form.fee_amount) >= 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        branch: form.branch,
        route_name: form.route_name.trim(),
        route_from: form.route_from.trim(),
        route_to: form.route_to.trim(),
        stops: form.stops.map((s) => s.trim()).filter(Boolean),
        fee_amount: Number(form.fee_amount),
      };
      if (editingId) {
        await busRouteApi.update(editingId, payload);
        toast.success("Bus route updated");
      } else {
        await busRouteApi.create(payload);
        toast.success("Bus route added");
      }
      closeForm();
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteRow) return;
    setDeleting(true);
    try {
      await busRouteApi.remove(confirmDeleteRow._id);
      toast.success("Bus route deleted");
      setConfirmDeleteRow(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // Branch cards stand in for the whole page until a branch is picked.
  if (scope.showPicker) {
    return (
      <BranchPickerScreen
        title="Bus Routes"
        subtitle="Pick a branch to view and manage its routes."
        branches={scope.branches}
        loading={scope.loadingBranches || summary === null}
        metricFor={metricFor}
        allMetric={{
          primary: (summary || []).reduce((n, r) => n + (r.total || 0), 0),
          primaryLabel: "routes",
        }}
        onSelect={scope.setBranchId}
      />
    );
  }

  return (
    <div className="space-y-5">
      {scope.enabled && (
        <BranchScopeBar
          branch={scope.branch}
          branches={scope.branches}
          isAllBranches={scope.isAllBranches}
          onChange={scope.setBranchId}
          onBack={scope.clear}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Bus Routes</h2>
          <p className="text-sm text-slate-500">
            {filteredRoutes.length} of {routes.length} bus route
            {routes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={openAddForm}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Bus Route
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by route, branch, from or to..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!scope.enabled && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[200px] text-sm">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b._id} value={b._id}>
                  {b.name} ({b.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  // Redundant while a single branch is open - the scope bar
                  // above already says which one, and dropping it gives the
                  // route columns the width back.
                  ...(lockedBranchId ? [] : ["Branch"]),
                  "Route Name",
                  "From",
                  "To",
                  "Stops",
                  "Fee (Yearly)",
                  "",
                ].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={lockedBranchId ? 6 : 7} className="px-4 py-8 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && routes.length === 0 && (
                <tr>
                  <td colSpan={lockedBranchId ? 6 : 7} className="px-4 py-8 text-center text-slate-400">
                    {lockedBranchId
                      ? "No bus routes set up for this branch yet."
                      : "No bus routes yet."}
                  </td>
                </tr>
              )}
              {!loading && routes.length > 0 && filteredRoutes.length === 0 && (
                <tr>
                  <td colSpan={lockedBranchId ? 6 : 7} className="px-4 py-8 text-center text-slate-400">
                    No routes match "{search}".
                  </td>
                </tr>
              )}
              {!loading &&
                pagedRoutes.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50">
                    {!lockedBranchId && (
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <Bus className="w-4 h-4 text-slate-400" />
                          {r.branch?.name} ({r.branch?.code})
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-700">{r.route_name}</td>
                    <td className="px-4 py-3 text-slate-500">{r.route_from || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{r.route_to || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.stops && r.stops.length > 0 ? (
                        <span title={r.stops.join(", ")}>
                          {r.stops.length} stop{r.stops.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {rup(r.fee_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEditForm(r)}
                          className="text-slate-400 hover:text-indigo-600"
                          aria-label="Edit bus route"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteRow(r)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Delete bus route"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={filteredRoutes.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          noun="routes"
        />
      </div>

      <Dialog
        open={showForm}
        onOpenChange={(open) => (open ? setShowForm(true) : closeForm())}
      >
        <DialogContent
          className="max-w-lg max-h-[85vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Bus Route" : "Add Bus Route"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Branch *
              </label>
              {lockedBranchId ? (
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700">
                  <Bus className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {scope.branch?.name} ({scope.branch?.code})
                  </span>
                </div>
              ) : (
                <Select
                  value={form.branch}
                  onValueChange={(v) => setForm({ ...form, branch: v })}
                  disabled={!!editingId}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map((b) => (
                      <SelectItem key={b._id} value={b._id}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Route Name *
              </label>
              <Input
                value={form.route_name}
                onChange={(e) => setForm({ ...form, route_name: e.target.value })}
                placeholder="e.g. North Route"
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Route From
              </label>
              <Input
                value={form.route_from}
                onChange={(e) => setForm({ ...form, route_from: e.target.value })}
                placeholder="Optional"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Route To
              </label>
              <Input
                value={form.route_to}
                onChange={(e) => setForm({ ...form, route_to: e.target.value })}
                placeholder="Optional"
                className="text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                In-between Places
              </label>
              <div className="space-y-2">
                {form.stops.map((stop, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={stop}
                      onChange={(e) => setStop(i, e.target.value)}
                      placeholder={`Stop ${i + 1}`}
                      className="text-sm"
                    />
                    {form.stops.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStop(i)}
                        className="text-slate-400 hover:text-red-600 shrink-0"
                        aria-label="Remove stop"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStop}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Stop
                </Button>
              </div>
            </div>

            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Fee Amount (Yearly) ₹ *
              </label>
              <Input
                type="number"
                value={form.fee_amount}
                onChange={(e) => setForm({ ...form, fee_amount: e.target.value })}
                placeholder="Flat yearly fee for the full route"
                className="text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmDeleteRow}
        onOpenChange={() => setConfirmDeleteRow(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete bus route?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-medium text-slate-800">
              {confirmDeleteRow?.route_name}
            </span>{" "}
            ({confirmDeleteRow?.branch?.name}) will be removed.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteRow(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
