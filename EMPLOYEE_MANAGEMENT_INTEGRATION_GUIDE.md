# Employee Management — Team Integration Guide

## Purpose

This guide is for the moment the real team MERN repository becomes available.

The current standalone project intentionally contains temporary local infrastructure.

## 1. Obtain the team repository

First clone or obtain the team's project.

Do not overwrite it with this standalone project.

Create a safe feature branch from the team's current `develop` branch.

```bash
git checkout develop
git pull origin develop
git checkout -b feature/employee-management
```

## 2. Inspect the team project

Find:
- backend entry point
- frontend entry point
- existing User model
- authentication middleware
- JWT verification
- role/permission middleware
- database connection
- API service
- React routing
- UI component system
- validation utilities

The team repository is the source of truth.

## 3. Keep/adapt/remove

| Standalone part | Team equivalent | Action |
|---|---|---|
| Local JWT | Team JWT | REMOVE local, REUSE team |
| Local User model | Team User model | REMOVE local, USE team |
| Local role middleware | Team authorization | REMOVE local, USE team |
| Local DB config | Team DB config | REMOVE local, USE team |
| Employee model | Team models | ADAPT |
| Employee controllers | Team controllers | ADAPT |
| Employee routes | Team routes | ADAPT |
| Employee API service | Existing API client | MERGE |
| Employee pages | Existing React app | ADAPT |
| Local styling | Team UI | ALIGN |
| Local login | Team login | REMOVE local |

## 4. Employee model integration

Inspect the team's User schema.

Change the standalone `Employee.user` reference to point to the team's actual User model.

Do not duplicate name/email/password/role if those already belong to User.

Preserve Employee-specific information:
- employeeId
- phone
- department
- designation
- joiningDate
- salary
- employmentStatus

Adjust field names only to match team conventions.

## 5. Authentication integration

Delete/avoid copying:
- local login controller
- local JWT secret/config
- local User model
- local auth middleware

Replace their usage with the team's existing middleware.

The Employee controller should receive the authenticated user from the team's middleware.

## 6. Route integration

Add Employee routes to the team's existing Express routing.

Do not create a second Express server.

Do not create duplicate `/api` prefixes if the team already mounts them.

## 7. API service integration

Move/merge Employee API functions into the team's existing API service.

Do not create a second Axios instance unless the team's architecture explicitly requires it.

## 8. Frontend integration

Move/adapt:
- Employee List
- Employee Details
- Add Employee
- Edit Employee
- Profile

into the team's existing pages/components structure.

Reuse their:
- layout
- navbar
- buttons
- forms
- notifications
- routing
- auth context
- styling

## 9. Remove temporary infrastructure

After successful integration, the final team branch should NOT contain:
- standalone login
- duplicate User model
- duplicate JWT
- duplicate role middleware
- standalone DB configuration
- duplicate API client

unless the team explicitly decides otherwise.

## 10. Verify

Test:
- Admin
- HR
- Employee
- create
- list
- search
- details
- update
- activate
- deactivate
- duplicate validation
- authorization

Then run the team's test/lint/build commands.

## 11. Review Git diff

```bash
git status
git diff --stat
git diff
```

Unexpected unrelated changes should be removed/reviewed before commit.

## 12. Commit and push

```bash
git add .
git commit -m "feat(employees): implement employee management"
git push -u origin feature/employee-management
```

Create a Pull Request:

`feature/employee-management` → `develop`

Do not merge it yourself if team policy requires another member to review it.
