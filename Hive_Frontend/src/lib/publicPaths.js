// Paths that are reachable with no login at all (see App.jsx). Both
// AuthContext.jsx (skip the on-mount token/session check) and http.js (skip
// the forced window.location redirect on a failed silent-refresh) need to
// know about these, so it's defined once here rather than duplicated.
export const PUBLIC_PATHS = ["/teacher-registration"];

export function isPublicPath(pathname = window.location.pathname) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}
