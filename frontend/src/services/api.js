import axiosInstance from "../api/axios";

// Turns any axios failure into an Error carrying the server's own message, the
// HTTP status and the optional per-field validation errors.
//
// Callers used to receive either a raw axios error or a bare Error with no
// status, so a field-level validation message from express-validator was
// unreachable and every failure looked like the same generic string.
const api = async (endpoint, options = {}) => {
  const method = (options.method || "GET").toLowerCase();

  let data;

  if (options.body !== undefined && options.body !== null) {
    data = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
  }

  try {
    const response = await axiosInstance({
      url: endpoint,
      method,
      data,
      headers: options.headers,
    });

    return response.data;
  } catch (error) {
    if (error.response?.data) {
      const payload = error.response.data;
      const wrapped = new Error(
        payload.message || "API request failed"
      );

      wrapped.status = error.response.status;
      wrapped.errors = payload.errors || [];
      wrapped.payload = payload;

      throw wrapped;
    }

    if (error.request) {
      const offline = new Error(
        "Could not reach the server. Check your connection and try again."
      );

      offline.status = 0;
      offline.cause = error;

      throw offline;
    }

    throw error;
  }
};

export const extractFieldErrors = (error) => {
  if (!error?.errors?.length) return {};

  return error.errors.reduce((fields, issue) => {
    if (issue?.field) fields[issue.field] = issue.message;
    return fields;
  }, {});
};

export default api;