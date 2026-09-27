import axiosInstance from "../api/axios";

const api = async (endpoint, options = {}) => {
  const method = (options.method || "GET").toLowerCase();
  const data = options.body ? JSON.parse(options.body) : undefined;

  try {
    const response = await axiosInstance({
      url: endpoint,
      method,
      data,
      headers: options.headers,
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      throw new Error(error.response.data.message || "API request failed");
    }
    throw new Error(error.message || "Network error");
  }
};

export default api;