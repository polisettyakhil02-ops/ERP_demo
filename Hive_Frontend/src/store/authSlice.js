import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { authApi } from "@/api/authApi";

// ── Helpers ──────────────────────────────────────────────────────────────────

function persistSession({ user, accessToken, refreshToken }) {
  localStorage.setItem("mm_access_token", accessToken);
  localStorage.setItem("mm_refresh_token", refreshToken);
  localStorage.setItem("mm_user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("mm_access_token");
  localStorage.removeItem("mm_refresh_token");
  localStorage.removeItem("mm_user");
  localStorage.removeItem("mm_erp_role");
}

function hydrateUser() {
  try {
    const raw = localStorage.getItem("mm_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Slice ────────────────────────────────────────────────────────────────────

const initialUser = hydrateUser();

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: initialUser,
    isAuthenticated: Boolean(initialUser),
  },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },

    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
    },

    clearError(state) {
      state.error = null;
    },
  },
});

export const { setUser, logout, clearError } = authSlice.actions;
export default authSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectUser = (state) => state.auth.user;
