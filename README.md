# Employee Attendance and Payroll Management

This repository contains the MERN implementation of the employee management workspace. The active application is built with React, Node.js, Express, MongoDB, Mongoose, JWT, and bcryptjs.

Attendance, leave management, payroll calculations, and reporting dashboards are **Pending MERN migration**. The current MERN application provides authentication and employee directory CRUD foundations.

## Structure

```text
backend/
  src/config/          MongoDB connection
  src/controllers/     Authentication and employee controllers
  src/middleware/      JWT protection and role authorization
  src/models/          User and Employee Mongoose models
  src/routes/          REST route definitions
  src/server.js        Express entry point
frontend/
  src/App.jsx          Authentication and employee workspace UI
  src/services/api.js  Fetch client with JWT headers
```

## Requirements

- Node.js 20 or newer
- npm
- A running MongoDB instance or MongoDB Atlas connection

## Configuration

Create `backend/.env` from `backend/.env.example`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/employee_attendance_payroll
JWT_SECRET=replace-with-a-strong-secret
CLIENT_URL=http://localhost:5173
```

Create `frontend/.env` from `frontend/.env.example` when the API is not local:

```env
VITE_API_URL=http://localhost:5000
```

Never commit `.env` files or real credentials.

## Run Locally

Start the backend in one terminal:

```powershell
cd backend
npm install
npm run dev
```

Start the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The API runs at `http://localhost:5000` and the Vite frontend normally runs at `http://localhost:5173`.

## Authentication

Public registration creates employee users only. Login returns a one-day JWT. The frontend stores the token locally, restores the session with `/api/auth/me`, sends it as `Authorization: Bearer <token>`, and removes it on logout.

Roles are enforced by the API:

- `employee`: authenticated read access
- `hr`, `admin`: employee management writes

## API

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/health` | Public |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | JWT required |
| GET | `/api/employees` | JWT required |
| GET | `/api/employees/:id` | JWT required |
| POST | `/api/employees` | Admin/HR |
| PUT | `/api/employees/:id` | Admin/HR |
| DELETE | `/api/employees/:id` | Admin/HR |

## Validation

Backend syntax checks:

```powershell
cd backend
node --check src/server.js
```

Frontend production build:

```powershell
cd frontend
npm run build
```

The authentication flow should be tested in this order: health, register, login, `/api/auth/me` with the returned token, `/api/auth/me` without a token, `/api/auth/me` with an invalid token, and protected employee requests.

## Production Considerations

Use a strong secret from a deployment secret manager, restrict CORS to the deployed frontend origin, use HTTPS, and consider replacing browser local storage with secure HttpOnly cookies for JWT delivery.# Employee Attendance and Payroll Management System
