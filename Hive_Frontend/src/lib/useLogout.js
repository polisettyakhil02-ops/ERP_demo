import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/api/authApi";
import { logout as logoutAction } from "@/store/authSlice";
import { useRole } from "@/lib/RoleContext";

export function useLogout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { logout: clearRole } = useRole();

  return async function logout() {
    try {
      await authApi.logout();
    } catch {
      // best-effort; still clear local session below
    }

    localStorage.removeItem("mm_access_token");
    localStorage.removeItem("mm_refresh_token");
    localStorage.removeItem("mm_user");
    localStorage.removeItem("mm_erp_role");

    dispatch(logoutAction());
    clearRole();
    navigate("/", { replace: true });
  };
}
