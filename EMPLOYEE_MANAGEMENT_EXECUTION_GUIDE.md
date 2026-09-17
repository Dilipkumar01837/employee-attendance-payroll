# Employee Management — Beginner Execution Guide

## 1. Required software

Install:
- Node.js LTS
- npm (included with Node.js)
- MongoDB Community Server OR use a MongoDB Atlas connection
- VS Code
- Git (optional for standalone development)
- Postman or Thunder Client (optional)

Verify Node/npm:

```bash
node --version
npm --version
```

## 2. Open the project

Extract the ZIP and open `employee-management-standalone` in VS Code.

There are two applications:
- `backend`
- `frontend`

## 3. Configure backend

Open Terminal 1:

```bash
cd backend
npm install
copy .env.example .env
```

On macOS/Linux use:

```bash
cp .env.example .env
```

Open `backend/.env`.

For local MongoDB, the default is:

`mongodb://127.0.0.1:27017/employee_management`

Do not commit `.env`.

## 4. Start MongoDB

If MongoDB is installed locally, start the MongoDB service using the normal method for your installation.

Then in Terminal 1:

```bash
cd backend
npm run seed
```

Successful result should say `Seed complete`.

Demo accounts:

- Admin — `admin@example.com` / `Admin123!`
- HR — `hr@example.com` / `Hr12345!`
- Employee — `employee@example.com` / `Employee123!`

The seed creates one employee record: `EMP001`.

## 5. Start backend

Terminal 1:

```bash
cd backend
npm run dev
```

Expected:

`Backend running on http://localhost:5000`

Health check:

Open:

`http://localhost:5000/api/health`

Expected JSON:

```json
{"status":"ok"}
```

## 6. Start frontend

Open Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Vite normally gives:

`http://localhost:5173`

Open that in your browser.

## 7. Login

Use the demo Admin account first:

`admin@example.com`

Password:

`Admin123!`

Admin can create, edit, activate and deactivate employees.

Then test HR:

`hr@example.com`

`Hr12345!`

Then test Employee:

`employee@example.com`

`Employee123!`

## 8. Manual Employee test

1. Login as Admin.
2. Open Employees.
3. Click Add Employee.
4. Enter a new unique Employee ID.
5. Enter name/email/phone/department/designation/date/salary.
6. Submit.
7. Confirm the new employee appears.
8. Open View.
9. Open Edit.
10. Change department/designation.
11. Save.
12. Deactivate the employee.
13. Confirm status changes to inactive.
14. Activate it again.
15. Search using name or employee ID.
16. Filter by status.
17. Logout.
18. Login as Employee.
19. Confirm Add Employee is unavailable.
20. Confirm the employee cannot modify another employee.

## 9. API testing

Base URL:

`http://localhost:5000/api`

Login:

`POST /auth/login`

Body:

```json
{
  "email": "admin@example.com",
  "password": "Admin123!"
}
```

Copy the returned JWT and use:

`Authorization: Bearer <token>`

Employee list:

`GET /employees`

Create:

`POST /employees`

Example body:

```json
{
  "employeeId": "EMP002",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Jane123!",
  "phone": "+91 9876543211",
  "department": "Finance",
  "designation": "Analyst",
  "joiningDate": "2026-01-15",
  "salary": 500000,
  "employmentStatus": "active"
}
```

Update:

`PUT /employees/<mongo-id>`

Status:

`PATCH /employees/<mongo-id>/status`

Body:

```json
{"status":"inactive"}
```

## 10. Common errors

### MongoDB connection failed

Check MongoDB is running and `MONGODB_URI` in `.env` is correct.

### 401 Authentication required

Login again and make sure the JWT is being sent.

### 403 Forbidden

The logged-in role does not have permission.

### 409 Employee ID already exists

Choose another Employee ID.

### 409 Email already exists

Use a different email.

### Frontend cannot connect

Make sure backend Terminal 1 is running on port 5000.

### Port already in use

Stop the process using that port or change `PORT` in `.env` and the frontend API URL accordingly.

## 11. Build frontend

Terminal 2:

```bash
cd frontend
npm run build
```

A successful build creates `frontend/dist`.

## 12. Stop the project

Press `Ctrl + C` in each running terminal.

## 13. Before team integration

Do NOT copy the local JWT/User system into the team's project blindly.

Wait for the actual team repository and follow:

`EMPLOYEE_MANAGEMENT_INTEGRATION_GUIDE.md`.
