# Nexora Social Frontend

React + Vite + Tailwind + Context API.

## Setup
1. `cp .env.example .env`
2. `npm install`
3. `npm run dev`

## Backend
Ensure backend is running on `http://localhost:5000` (or update `VITE_API_URL`).
In development, Vite exposes the app on the local network and proxies `/api` and
Socket.IO requests to `localhost:5000`. Open the `Network` URL printed by Vite
on a phone connected to the same Wi-Fi. If the backend uses another port, update
the proxy targets in `vite.config.js`.

## OAuth (Auth0)
Set only `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` to enable Google/GitHub
sign-in (no audience/API configuration is needed). The Auth0 provider uses
`window.location.origin` as its `redirect_uri`, so in the Auth0 application
settings:

- **Allowed Callback URLs**: every origin the app runs on, for example
  `http://localhost:3000, https://nexoras-social.vercel.app`
  (also add `<origin>/auth/callback` if you keep using the legacy callback route)
- **Allowed Web Origins**: the same origins
- **Allowed Logout URLs**: the same origins

After the redirect, the frontend sends the Auth0 ID token (`claims.__raw`) to the
backend `POST /auth/oauth` endpoint with cookies enabled. That endpoint owns the
app session and the user role; Auth0 only handles authentication. Google uses the
`google-oauth2` connection and GitHub uses `github`.

On Vercel, add the same two env vars in the project settings and redeploy.
`vercel.json` rewrites every route to `index.html`, so the callback route and
deep links keep working on refresh. OAuth configuration is optional; password
login remains available without it.

## Features (Phase 1)
- Auth (Login/Signup/OTP)
- Profile (view/update + avatar upload)
- Friends (suggestions/requests/list/profile)
- Chat (REST + Socket.IO client)

## Notes
- Uses httpOnly cookies (withCredentials)
- Socket.IO uses the Vite proxy during development and the configured API host in production.
