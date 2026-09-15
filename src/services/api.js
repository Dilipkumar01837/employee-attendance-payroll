import { appConfig } from '../config/appConfig';

async function request(endpoint) {
  const response = await fetch(
    `${appConfig.apiBaseUrl}${endpoint}`
  );

  if (!response.ok) {
    throw new Error('Unable to load data');
  }

  return response.json();
}

export function fetchEmployees() {
  return request('/employees');
}

export function fetchAttendance() {
  return request('/attendance');
}

export function fetchLeaveRequests() {
  return request('/leave');
}

export function fetchPayroll() {
  return request('/payroll');
}