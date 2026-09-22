import { useEffect, useState } from "react";
import { toast } from "sonner";
import { branchApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { useRole, ROLE_META } from "@/lib/RoleContext";
import { useSchoolBranding } from "@/lib/schoolBranding";
import SchoolLogo from "@/components/SchoolLogo";
import { MapPin, User, CalendarDays, ArrowRight } from "lucide-react";
import chairmanPortrait from "@/assets/masterminds/chairman-portrait-blend.png";
import dominareLogo from "@/assets/masterminds/dominare-logo-mark.png";
import "./WelcomeScreenDark.css";

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

const TODAY_LABEL = new Date().toLocaleDateString("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// The post-login welcome page for every tenant - a full-page takeover (no
// sidebar/topbar), shown once right after login before the app shell ever
// mounts. Branding (logo/ERP name/school label) comes from
// useSchoolBranding(), so this one component renders correctly for both
// schools.
export default function WelcomeScreenDark({ onContinue }) {
  const { user } = useAuth();
  const { activeRole } = useRole();
  const meta = ROLE_META[activeRole] || {};
  const branding = useSchoolBranding();

  // Admin Officer is the one multi-branch role (see CategoryFeeReport.jsx's
  // identical check) - "which branch is being viewed" isn't a single answer
  // for them the way it is for every other role, so the chip below reads
  // "All Branches" instead of naming one.
  const isMultiBranch = user?.role === "admin_officer";
  const [branchLabel, setBranchLabel] = useState(null);

  useEffect(() => {
    branchApi
      .list()
      .then((data) => {
        const branches = data?.data || data || [];
        if (isMultiBranch) {
          setBranchLabel(
            branches.length > 0 ? `All Branches (${branches.length})` : "All Branches",
          );
        } else {
          setBranchLabel(branches[0]?.name || "Your branch");
        }
      })
      .catch((err) => {
        toast.error("Failed to load branch", { description: apiErrorMessage(err) });
        setBranchLabel(isMultiBranch ? "All Branches" : "Your branch");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="welcome-splash">
      <div className="welcome-pane welcome-copy-pane">
        <div className="welcome-spacer-top" />
        <div className="welcome-content">
          <div className="flex items-center gap-3 mb-8 welcome-rise welcome-delay-1">
            <SchoolLogo
              branding={branding}
              fallbackIcon={meta.icon}
              className="h-9 w-auto max-w-[180px] object-contain"
              fallbackClassName="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 via-red-500 to-cyan-500 shadow-lg shadow-orange-500/30 flex items-center justify-center text-lg shrink-0"
              onDark
            />
            <div>
              <p className="text-sm font-bold text-white leading-tight">{branding.erpName}</p>
              <p className="text-[11px] text-slate-400 capitalize">{meta.label}</p>
            </div>
          </div>

          <p className="text-[13px] font-bold tracking-[0.16em] uppercase text-orange-300 mb-2 welcome-rise welcome-delay-2">
            Welcome to the
          </p>
          <p className="text-[21px] font-semibold text-slate-200/80 mb-3 welcome-rise welcome-delay-3">
            {branding.erpName}
          </p>
          <h1 className="welcome-school font-extrabold tracking-tight text-white text-balance mb-8 welcome-rise welcome-delay-4">
            {branding.schoolLabel}
          </h1>

          <div className="flex flex-wrap gap-2.5 mb-8 welcome-rise welcome-delay-5">
            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-orange-200 bg-orange-500/15 border border-orange-300/35">
              <MapPin className="w-3.5 h-3.5 text-orange-300 shrink-0" />
              {branchLabel ? `Viewing ${branchLabel}` : "Loading branch…"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-slate-100 bg-white/[0.07] border border-white/[0.13]">
              <User className="w-3.5 h-3.5 shrink-0" />
              {meta.label || "Staff"}
            </span>
          </div>

          <div className="welcome-rise welcome-delay-6">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:-translate-y-px px-6 py-3.5 text-sm font-bold text-orange-950 shadow-[0_14px_26px_-10px_rgba(249,115,22,0.75)] hover:shadow-[0_18px_30px_-10px_rgba(249,115,22,0.85)] transition"
            >
              Continue to Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="welcome-spacer-bottom" />
        <div className="welcome-brand-corner welcome-rise welcome-delay-9">
          <img
            src={dominareLogo}
            alt="Dominare Tech Group"
            className="welcome-brand-logo"
          />
        </div>
      </div>

      <div className="welcome-pane welcome-rail">
        <div className="welcome-rail-info welcome-rise welcome-delay-7">
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-500 mb-5">
            Session
          </p>

          <div className="py-4 border-t border-white/0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-orange-300 shrink-0" />
              Today
            </div>
            <div className="text-[15px] font-semibold text-slate-200">{TODAY_LABEL}</div>
          </div>

          <div className="py-4 border-t border-white/[0.09]">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5">
              <MapPin className="w-3.5 h-3.5 text-orange-300 shrink-0" />
              {isMultiBranch ? "Branches" : "Branch"}
            </div>
            <div className="text-[19px] font-bold text-orange-200">
              {branchLabel || "—"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Currently viewing</div>
          </div>

          <div className="py-4 border-t border-white/[0.09]">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1.5">
              <User className="w-3.5 h-3.5 text-orange-300 shrink-0" />
              Signed in as
            </div>
            <div className="text-[19px] font-bold text-slate-100">
              {user?.full_name || user?.email || "Staff"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{meta.label}</div>
          </div>
        </div>

        <div
          className="welcome-rail-portrait welcome-rise welcome-delay-8"
          style={{
            backgroundImage: `linear-gradient(200deg, rgba(23,19,16,0.55) 0%, rgba(18,14,10,0.18) 45%, rgba(10,12,18,0.6) 100%), url(${chairmanPortrait})`,
          }}
        >
          <div className="welcome-portrait-caption">
            <p className="welcome-portrait-eyebrow">Leadership</p>
            <p className="welcome-portrait-name">Dr. Raju Sangani</p>
            <p className="welcome-portrait-title">Chairman</p>
          </div>
        </div>
      </div>
    </div>
  );
}
