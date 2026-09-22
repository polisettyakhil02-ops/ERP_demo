import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { schoolApi, branchApi } from "@/api/api";
import { School, Building2, ArrowRight } from "lucide-react";

export default function SuperAdminDashboard() {
  const [schools, setSchools] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([schoolApi.list(), branchApi.list()])
      .then(([s, b]) => {
        setSchools(s || []);
        setBranches(b || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeSchools = schools.filter((s) => s.is_active !== false).length;
  const activeBranches = branches.filter((b) => b.is_active !== false).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Super Admin</h2>
        <p className="text-sm text-slate-500">
          Company-wide overview across every school and branch
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <School className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">
              {loading ? "—" : activeSchools}
            </p>
            <p className="text-sm text-slate-500">Active schools</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">
              {loading ? "—" : activeBranches}
            </p>
            <p className="text-sm text-slate-500">Active branches</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <Link
          to="/schools"
          className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
        >
          <div>
            <p className="text-sm font-medium text-slate-800">Manage Schools</p>
            <p className="text-xs text-slate-500">
              Add a school, update its logo, or review its branches
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </Link>
        <Link
          to="/branches"
          className="flex items-center justify-between px-5 py-4 hover:bg-slate-50"
        >
          <div>
            <p className="text-sm font-medium text-slate-800">Manage Branches</p>
            <p className="text-xs text-slate-500">Add or edit branches across every school</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </Link>
      </div>
    </div>
  );
}
