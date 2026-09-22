import React, { useState } from "react";
import { authApi } from "@/api/authApi";
import { useRole } from "@/lib/RoleContext";
import { GraduationCap, ArrowRight, Sparkles, Eye, EyeOff } from "lucide-react";
import { useDispatch } from "react-redux";
import { setUser } from "../store/authSlice";
import { loadSchools } from "@/lib/schoolBranding";

const BACKEND_TO_FRONTEND_ROLE = {
  admin_officer: "finance",
  principal: "principal",
  teacher: "teacher",
  accounts_manager: "consultant",
  student: "student",
  super_admin: "superadmin",
};

export default function RoleLogin() {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const { selectRole } = useRole();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) return;

    setIsLoading(true);
    setAuthError("");

    try {
      const data = await authApi.login(email, password);

      if (data.accessToken) {
        localStorage.setItem("mm_access_token", data.accessToken);
      }
      if (data.user) {
        localStorage.setItem("mm_user", JSON.stringify(data.user));
        dispatch(setUser(data.user));
        loadSchools();

        // One-shot flag for App.jsx - show the post-login welcome screen on
        // this login only, never on a plain refresh/session restore (those
        // read straight from localStorage and never call this handler).
        // Cleared the moment the welcome screen's "Continue to Dashboard" is
        // clicked.
        sessionStorage.setItem("mm_show_welcome", "1");

        const mappedRole = BACKEND_TO_FRONTEND_ROLE[data.user.role];

        if (mappedRole) {
          localStorage.setItem("mm_erp_role", mappedRole);
          selectRole(mappedRole);
        }
      }
    } catch (err) {
      console.log(err);
      setAuthError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Login failed",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6 flex flex-col items-center">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-2xl font-black text-white tracking-tight">
              MasterMinds ERP
            </p>
            <p className="text-xs text-slate-400 tracking-widest uppercase">
              by Dominare Tech Pvt Ltd
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <p className="text-slate-400 text-sm">Sign in to continue</p>
          <Sparkles className="w-4 h-4 text-indigo-400" />
        </div>

        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && handleLogin(e)}
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.length > 20) return;
                    setPassword(val);
                    if (val.length === 0) {
                      setPasswordError("");
                    } else if (val.length < 10) {
                      setPasswordError(
                        "Password must be at least 10 characters",
                      );
                    } else {
                      setPasswordError("");
                    }
                  }}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin(e)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-amber-400 mt-1.5">{passwordError}</p>
              )}
            </div>

            {authError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                {authError}
              </p>
            )}

            <button
              onClick={handleLogin}
              disabled={
                isLoading || !email || !password || password.length < 10
              }
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="mt-12 text-xs text-slate-600">
          © 2026 Dominare Tech Pvt Ltd · MasterMinds ERP · All rights reserved
        </p>
      </div>
    </div>
  );
}
