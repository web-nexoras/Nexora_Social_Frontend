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
Set `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` to enable Google/GitHub sign-in.
In the Auth0 application settings, allow the app's `/auth/callback` URL under
Allowed Callback URLs and the app origin under Allowed Web Origins. For phone
testing, include the PC's LAN URL shown by Vite as well. OAuth configuration is
optional; password login remains available without it.

## Features (Phase 1)
- Auth (Login/Signup/OTP)
- Profile (view/update + avatar upload)
- Friends (suggestions/requests/list/profile)
- Chat (REST + Socket.IO client)

## Notes
- Uses httpOnly cookies (withCredentials)
- Socket.IO uses the Vite proxy during development and the configured API host in production.
