import React, { createContext, useContext, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setUser, logout as logoutAction, selectUser } from "@/store/authSlice";
import { isPublicPath } from "@/lib/publicPaths";
import { loadSchools } from "@/lib/schoolBranding";
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  useEffect(() => {
    if (isPublicPath()) return;

    const token = localStorage.getItem("mm_access_token");
    const user = localStorage.getItem("mm_user");

    if (token && user) {
      dispatch(setUser(JSON.parse(user)));
    }

    // Warm the schools cache as soon as there's a token to auth the request
    // with - every branding lookup (logos, favicons) reads from it.
    if (token) loadSchools();
  }, [dispatch]);

  const logout = () => {
    dispatch(logoutAction());
  };

  // Kept for backward compat — now just redirects to "/" (role login)
  const navigateToLogin = () => {
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        logout,
        navigateToLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
