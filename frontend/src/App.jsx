import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import EmployeeList from "./pages/EmployeeList";
import EmployeeDetails from "./pages/EmployeeDetails";
import EmployeeFormPage from "./pages/EmployeeFormPage";
import Profile from "./pages/Profile";
import "./styles/app.css";

function Private({ children, roles }) {
  return <ProtectedRoute roles={roles}><Layout>{children}</Layout></ProtectedRoute>;
}

export default function App() {
  return <AuthProvider><BrowserRouter><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/employees" element={<Private><EmployeeList /></Private>} />
    <Route path="/employees/me" element={<Private><Profile /></Private>} />
    <Route path="/employees/:id" element={<Private><EmployeeDetails /></Private>} />
    <Route path="/employees/new" element={<Private roles={["ADMIN","HR"]}><EmployeeFormPage /></Private>} />
    <Route path="/employees/:id/edit" element={<Private roles={["ADMIN","HR"]}><EmployeeFormPage editing /></Private>} />
    <Route path="*" element={<Navigate to="/employees" replace />} />
  </Routes></BrowserRouter></AuthProvider>;
}
