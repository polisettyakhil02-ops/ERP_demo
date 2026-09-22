import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useRole } from "@/lib/RoleContext";
import { isRouteAllowed } from "@/lib/routeAccess";

export default function RoleRoute() {
  const { activeRole } = useRole();
  const { pathname } = useLocation();

  if (!isRouteAllowed(pathname, activeRole)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
