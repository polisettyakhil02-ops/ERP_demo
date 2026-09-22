import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  KeyRound,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  PenTool,
} from "lucide-react";
import { authApi } from "@/api/authApi";
import { uploadApi } from "@/api/uploadApi";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { useRole, ROLE_META } from "@/lib/RoleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

function formatAddress(address) {
  if (!address) return null;
  const parts = [
    [address.line1, address.line2].filter(Boolean).join(", "),
    address.city,
    address.district,
    address.pincode ? `${address.state} - ${address.pincode}` : address.state,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// Icon + label + value row, reused across the info cards below.
function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="min-w-0 pt-1.5">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm text-slate-700 mt-0.5 wrap-break-word">
          {value || <span className="text-slate-400">Not provided</span>}
        </p>
      </div>
    </div>
  );
}

function BranchCard({ branch }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{branch.name}</p>
        <span className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5 shrink-0">
          {branch.code}
        </span>
      </div>
      {formatAddress(branch.address) && (
        <p className="text-xs text-slate-500 mt-1.5">
          {formatAddress(branch.address)}
        </p>
      )}
      {branch.phone && (
        <p className="text-xs text-slate-400 mt-1">{branch.phone}</p>
      )}
    </div>
  );
}

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 20;

// Password input with a show/hide toggle and an inline error slot, shared
// by both steps of the change-password dialog below.
function PasswordInput({ value, onChange, error, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          className="pr-9"
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const EMPTY_PASSWORD_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function ChangePasswordDialog({ open, onClose }) {
  // Step 1: verify the current password. Step 2 (new + confirm) only
  // appears once that's confirmed correct.
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_PASSWORD_FORM);
  const [errors, setErrors] = useState({});
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => (er[field] ? { ...er, [field]: undefined } : er));
  };

  const handleClose = () => {
    setStep(1);
    setForm(EMPTY_PASSWORD_FORM);
    setErrors({});
    onClose();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!form.currentPassword) {
      setErrors({ currentPassword: "Enter your current password." });
      return;
    }
    setVerifying(true);
    try {
      await authApi.verifyPassword(form.currentPassword);
      setStep(2);
    } catch (err) {
      setErrors({ currentPassword: apiErrorMessage(err) });
    } finally {
      setVerifying(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (
      form.newPassword.length < PASSWORD_MIN ||
      form.newPassword.length > PASSWORD_MAX
    ) {
      nextErrors.newPassword = `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`;
    }
    if (form.newPassword !== form.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(form.currentPassword, form.newPassword);
      toast.success("Password updated successfully.");
      handleClose();
    } catch (err) {
      setErrors({ newPassword: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-600" />
            Change Password
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">
                Current Password
              </label>
              <PasswordInput
                autoFocus
                value={form.currentPassword}
                onChange={setField("currentPassword")}
                error={errors.currentPassword}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={verifying}>
                {verifying ? "Verifying..." : "Continue"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Current password verified
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="font-medium underline hover:text-emerald-800 shrink-0"
              >
                Change
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                New Password
              </label>
              <PasswordInput
                autoFocus
                value={form.newPassword}
                onChange={setField("newPassword")}
                error={errors.newPassword}
              />
              {!errors.newPassword && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Must be {PASSWORD_MIN}-{PASSWORD_MAX} characters.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">
                Confirm New Password
              </label>
              <PasswordInput
                value={form.confirmPassword}
                onChange={setField("confirmPassword")}
                error={errors.confirmPassword}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Update Password"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Self-service signature upload/edit - lets a Class Teacher or Principal
// set the image embedded on generated hall tickets (see HallTicket.jsx),
// since neither role can reach it through the Staff page (a Teacher has no
// Staff.update permission at all, and a Principal there can only edit
// Teacher records, never their own - see authController.updateMe).
function SignatureDialog({ open, onClose, currentUrl, onSaved }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(currentUrl || null);
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setFile(null);
    setPreview(currentUrl || null);
    onClose();
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let signature_url = currentUrl || null;
      if (file) {
        const { file_url } = await uploadApi.uploadFile(file, "staff");
        signature_url = file_url;
      }
      await authApi.updateMe(signature_url);
      toast.success("Signature updated.");
      onSaved(signature_url);
      setFile(null);
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="w-4 h-4 text-indigo-600" />
            Signature
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <p className="text-xs text-slate-500">
            This image is embedded on hall tickets you generate (as Class
            Teacher) or that reference you (as Principal).
          </p>
          {preview && (
            <img
              src={preview}
              alt="Signature preview"
              className="h-14 w-auto max-w-56 object-contain bg-slate-50 rounded border border-slate-200 p-1.5"
            />
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={pickFile}
            className="text-sm"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MyProfile() {
  const { activeRole } = useRole();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authApi.me();
        if (!cancelled) setProfile(data);
      } catch (err) {
        toast.error(apiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <p className="text-sm text-slate-500">
        Unable to load your profile right now.
      </p>
    );
  }

  const meta = ROLE_META[activeRole] || {};
  const roleLabel = ROLE_LABELS[profile.role] || profile.role;
  const branches = profile.branches?.length
    ? profile.branches
    : profile.branch
      ? [profile.branch]
      : [];
  const initial =
    profile.full_name?.[0] || profile.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero: identity + the one write action on this page, right where
          you're already looking - not buried after a scroll. */}
      <div
        className="rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5"
        style={{
          background:
            meta.gradient ||
            "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/15 ring-2 ring-white/40 backdrop-blur-sm flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-white">{initial}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-white truncate">
              {profile.full_name}
            </h1>
            <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-white bg-white/20 px-2.5 py-1 rounded-full">
              <ShieldCheck className="w-3 h-3" />
              {roleLabel}
            </span>
          </div>
        </div>
        <Button
          onClick={() => setShowPasswordDialog(true)}
          className="gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur-sm shrink-0 self-start sm:self-center"
        >
          <KeyRound className="w-4 h-4" />
          Change Password
        </Button>
      </div>

      {/* Details grid */}
      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Contact Information
          </h3>
          <div className="space-y-4">
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <InfoRow icon={Phone} label="Phone" value={profile.phone} />
            <InfoRow
              icon={MapPin}
              label="Address"
              value={formatAddress(profile.address)}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            Branch Details
          </h3>
          {branches.length ? (
            <div className="space-y-3">
              {branches.map((b) => (
                <BranchCard key={b._id} branch={b} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No branch assigned.</p>
          )}
        </div>

        {/* Only meaningful for Class Teacher / Principal - the two roles
            whose signature gets embedded on generated hall tickets (see
            HallTicket.jsx / classController.listClasses). */}
        {(profile.role === "teacher" || profile.role === "principal") && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm md:col-span-2">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-slate-400" />
              Signature
            </h3>
            <div className="flex items-center gap-4">
              {profile.signature_url ? (
                <img
                  src={profile.signature_url}
                  alt="Your signature"
                  className="h-12 w-auto max-w-48 object-contain bg-slate-50 rounded border border-slate-200 p-1.5"
                />
              ) : (
                <p className="text-sm text-slate-400">
                  Not uploaded yet - it will appear blank on hall tickets
                  until you add one.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => setShowSignatureDialog(true)}
              >
                <PenTool className="w-3.5 h-3.5" />
                {profile.signature_url ? "Change Signature" : "Add Signature"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <ChangePasswordDialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
      />
      <SignatureDialog
        open={showSignatureDialog}
        currentUrl={profile.signature_url}
        onClose={() => setShowSignatureDialog(false)}
        onSaved={(signature_url) =>
          setProfile((p) => ({ ...p, signature_url }))
        }
      />
    </div>
  );
}
