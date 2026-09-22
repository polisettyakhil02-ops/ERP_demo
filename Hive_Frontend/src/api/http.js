import axios from "axios";
import { isPublicPath } from "@/lib/publicPaths";

const BASE_URL =
  import.meta.env.VITE_API_URL || "https://www.themasterserp.com";

const http = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});
console.log(BASE_URL);
// ── Token injection ────────────────────────────────────────────────────────────
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("mm_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function isPublicApiRequest(config) {
  return typeof config?.url === "string" && config.url.includes("/api/public");
}

// ── Silent token refresh ───────────────────────────────────────────────────────
let isRefreshing = false;
let queue = []; // pending requests while refresh is in-flight

function processQueue(error, token = null) {
  queue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token),
  );
  queue = [];
}

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (!original) {
      return Promise.reject(err);
    }
    if (isPublicApiRequest(original)) {
      return Promise.reject(err);
    }
    if (
      original.url?.includes("/api/auth/refresh") ||
      original.url?.includes("/api/auth/login")
    ) {
      return Promise.reject(err);
    }
    // Silent refresh exists to recover from an EXPIRED access token on an
    // otherwise-authenticated request. A request that never carried a
    // Bearer token in the first place (e.g. any other pre-auth endpoint)
    // can 401 for reasons that have nothing to do with token expiry and
    // must not trigger a refresh attempt (which will itself fail with no
    // refresh cookie set, masking the real error).
    const hadAccessToken = Boolean(original.headers?.Authorization);
    if (hadAccessToken && err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return http(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${BASE_URL}/api/auth/refresh`,
          {},
          {
            withCredentials: true,
          },
        );
        console.log("triggered");

        localStorage.setItem("mm_access_token", data.accessToken);
        processQueue(null, data.accessToken);

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return http(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);

        localStorage.removeItem("mm_access_token");
        localStorage.removeItem("mm_user");
        localStorage.removeItem("mm_erp_role");
        if (!isPublicPath()) {
          window.location.href = "/";
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  },
);

export default http;
