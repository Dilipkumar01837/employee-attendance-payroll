import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("employee_management_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authService = {
  login: (data) => api.post("/auth/login", data)
};

export const employeeService = {
  getEmployees: (params = {}) => api.get("/employees", { params }),
  getEmployee: (id) => api.get(`/employees/${id}`),
  getMyProfile: () => api.get("/employees/me"),
  createEmployee: (data) => api.post("/employees", data),
  updateEmployee: (id, data) => api.put(`/employees/${id}`, data),
  updateEmployeeStatus: (id, status) => api.patch(`/employees/${id}/status`, { status })
};

export default api;
