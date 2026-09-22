import { useSyncExternalStore } from "react";
import { useAuth } from "@/lib/AuthContext";
import { schoolApi } from "@/api/api";

// Schools are now admin-managed data (see the Manage Schools page, Super
// Admin only) instead of a hardcoded table - this module is just a thin
// cache in front of GET /api/schools so every call site below keeps working
// unchanged. Branch.schoolName (and User.schoolName) stay free text (see
// Hive_Backend/src/utils/schoolName.js), so lookups here are by exact name,
// same as before.
let schools = [];
let loadPromise = null;
const listeners = new Set();

// Matches the app's prior implicit default (anything that isn't an exact
// name match has always fallen through to Krishnaveni branding).
const DEFAULT_SCHOOL_NAME = "Krishnaveni Talent School";

function notify() {
  listeners.forEach((fn) => fn());
}

// Call once at app boot (see AuthContext.jsx) - safe to call again, it just
// returns the in-flight/cached promise. Not awaited by most callers: this
// module is read synchronously all over the codebase (PDF export, the
// favicon-swap effect, etc.), so it's fine for the very first render(s)
// after a hard refresh to briefly see the placeholder from getSchoolMeta()
// below until this resolves and notify() triggers a re-render.
export function loadSchools() {
  if (loadPromise) return loadPromise;
  loadPromise = schoolApi
    .list({ activeOnly: true })
    .then((data) => {
      schools = data || [];
      notify();
      return schools;
    })
    .catch((err) => {
      console.error("Failed to load schools:", err.message);
      loadPromise = null; // allow a retry on the next getSchoolMeta()/loadSchools() call
      return schools;
    });
  return loadPromise;
}

function findByName(schoolName) {
  const target = String(schoolName ?? "").trim().toLowerCase();
  return schools.find((s) => s.name.trim().toLowerCase() === target);
}

function toMeta(school) {
  return {
    erpName: `${school.name} ERP`,
    schoolLabel: school.name,
    logo: school.logoUrl,
    logoAlt: school.name,
    favicon: school.faviconUrl,
  };
}

// Placeholder shown before the schools list has loaded, or if a name
// matches nothing - logo: null so SchoolLogo renders its icon fallback
// immediately rather than a broken image.
function placeholderMeta(schoolName) {
  return {
    erpName: "ERP",
    schoolLabel: schoolName || "School",
    logo: null,
    logoAlt: schoolName || "School",
    favicon: "/favicon.svg",
  };
}

export function getSchoolMeta(schoolName) {
  const match = findByName(schoolName) || findByName(DEFAULT_SCHOOL_NAME);
  return match ? toMeta(match) : placeholderMeta(schoolName);
}

export function useSchoolBranding() {
  const { user } = useAuth();
  useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => schools,
  );
  return getSchoolMeta(user?.schoolName);
}

// Only for the Manage Schools admin page, which needs every school
// (including inactive ones, so they can be reactivated) rather than the
// active-only branding cache above.
export async function listAllSchools() {
  const data = await schoolApi.list();
  return data || [];
}
