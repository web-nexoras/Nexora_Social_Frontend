# Nexora Social Frontend

React + Vite + Tailwind + Context API.

## Setup
1. `cp .env.example .env`
2. `npm install`
3. `npm run dev`

## Backend
Ensure backend is running on `http://localhost:5000` (or update `VITE_API_URL`).

## Features (Phase 1)
- Auth (Login/Signup/OTP)
- Profile (view/update + avatar upload)
- Friends (suggestions/requests/list/profile)
- Chat (REST + Socket.IO client)

## Notes
- Uses httpOnly cookies (withCredentials)
- Socket connects to backend URL
