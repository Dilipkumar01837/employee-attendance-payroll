# Employee Management — Standalone MERN Module

A clean standalone MERN implementation of the Employee Management responsibility.

> **Important:** This repository is intentionally standalone because the team's real repository was not available during development. The local authentication, User model, role middleware, and database configuration are **development infrastructure only**. When the team repository becomes available, reuse the team's authentication/JWT/User/database/API infrastructure and adapt the Employee Management logic to it.

## Features

- Employee CRUD
- Search and filtering
- Employee details/profile
- Activate/deactivate employees
- Backend validation
- Duplicate employee ID/email protection
- JWT authentication for local testing
- Admin / HR / Employee authorization
- React frontend with role-aware actions
- REST API
- Beginner-friendly execution and integration documentation

## Stack

- Node.js + Express
- MongoDB + Mongoose
- React + Vite
- Axios
- JWT
- bcryptjs

## Quick start

### Backend

```bash
cd backend
npm install
copy .env.example .env
npm run seed
npm run dev
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite, normally `http://localhost:5173`.

See `EMPLOYEE_MANAGEMENT_EXECUTION_GUIDE.md` for the full walkthrough.
See `EMPLOYEE_MANAGEMENT_INTEGRATION_GUIDE.md` when the team's repository becomes available.
