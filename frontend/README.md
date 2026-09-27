# Frontend

React client for the employee attendance and payroll system. See the
[repository README](../README.md) for setup, roles, and the attendance/payroll rules.

## Commands

```bash
npm install
npm run dev      # Vite dev server, default http://localhost:5173
npm run build    # production build into dist/
npm run lint     # oxlint
npm run preview  # serve the production build
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000` | Base URL of the API |

The backend's `CLIENT_URLS` allowlist must include the origin you serve this from. It
matches exact origins, so `http://localhost:5174` is not covered by an entry for
`http://localhost:5173`.

## Layout

| Path | Purpose |
| --- | --- |
| `src/pages/` | Route-level screens, including `Dashboard.jsx` |
| `src/components/` | Reusable UI, including the attendance and payroll views |
| `src/services/api.js` | Configured Axios client, attaches the auth token |
| `src/services/datetime.js` | IST date, time, and month helpers |

## Timezone handling

`src/services/datetime.js` is the only place this app formats a date for display.
It formats through `Intl.DateTimeFormat` with `timeZone: "Asia/Kolkata"`, matching how
the API buckets records, and exports `getCurrentISTMonth` for the month pickers. Avoid
calling `toLocaleDateString()` without a `timeZone` on its own in a new component;
without it the same record renders differently depending on the viewer's machine
settings.
