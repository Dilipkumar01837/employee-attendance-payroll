import axios from "axios";

// The base URL is the *backend origin* with no trailing slash and no /api
// suffix, because every endpoint below is written as "/api/...".
//
// Locally Vite proxies /api to the backend (see vite.config.js), so leaving
// VITE_API_URL unset in development keeps cookies on one origin and avoids CORS
// entirely. In production the two projects are different origins, so
// VITE_API_URL must be set on the Vercel project. It used to be baked into a
// committed .env.production, which meant pointing the app at a different backend
// required a code change; it is now an environment variable.
const getBaseURL = () => {
  const configured = import.meta.env.VITE_API_URL;

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (import.meta.env.PROD) {
    // Failing loudly beats silently sending every request to the frontend
    // origin, which returns the HTML shell and a confusing parse error.
    throw new Error(
      "VITE_API_URL is not set. Set it to the backend origin in your Vercel project environment."
    );
  }

  return "http://localhost:5000";
};

const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  // The session cookie is HttpOnly, so it has to travel on the request. Without
  // this the browser drops it and every call comes back 401.
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // 401 means the cookie is missing, expired or rejected. 403 is deliberately
    // excluded: it means the account is authenticated but not allowed, and
    // bouncing the user to the login screen would throw away that distinction.
    if (status === 401) {
      window.dispatchEvent(new Event("auth:expired"));
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
