import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

export default function PageHeader({ title, subtitle, breadcrumb, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        {breadcrumb && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
            <Link
              to="/"
              className="hover:text-indigo-600 flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
            {breadcrumb.map((b) => (
              <React.Fragment key={b.label}>
                <ChevronRight className="w-3 h-3" />
                {b.path ? (
                  <Link to={b.path} className="hover:text-indigo-600">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-slate-600">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
