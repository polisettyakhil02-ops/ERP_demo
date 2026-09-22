/**
 * store.js — Redux store
 *
 * Currently holds auth state. Add more slices here as needed
 * (e.g., a branchSlice if you want branch selection in Redux).
 */

import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});
