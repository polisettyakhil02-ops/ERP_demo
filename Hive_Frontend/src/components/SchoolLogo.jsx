import { useState } from "react";

// Renders a school's logo image; falls back to a role-emoji badge if the
// image fails to load (e.g. the asset isn't deployed yet) so the chrome
// never shows a broken-image icon. Both real logo files are wide wordmark
// lockups (not square marks), and KTS.jpg has an opaque white background
// (JPEGs can't carry alpha) - `onDark` wraps the image in a small white
// card so it doesn't show a jarring white box when placed directly on a
// dark background; omit it on light backgrounds (e.g. the white topbar).
export default function SchoolLogo({ branding, fallbackIcon, fallbackClassName, className, onDark }) {
  const [errored, setErrored] = useState(false);

  // branding.logo is null while the schools cache is still loading (or for
  // an unmatched school name) - <img src={null}> wouldn't reliably fire
  // onError, so it's checked up front rather than relying on that alone.
  if (errored || !branding?.logo) {
    return <div className={fallbackClassName}>{fallbackIcon}</div>;
  }

  const img = (
    <img
      src={branding.logo}
      alt={branding.logoAlt}
      className={className}
      onError={() => setErrored(true)}
    />
  );

  if (!onDark) return img;

  return <div className="bg-white rounded-md px-2 py-1 inline-flex items-center shrink-0">{img}</div>;
}
