# ProfileHUB

A LinkedIn-style professional network with **location-based discovery**, **connection requests** and **realtime chat**.

## Stack

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | Vue 3 (Composition API), Vite, Pinia, Vue Router, socket.io-client   |
| UI       | Custom component library (`client/src/components/ui`), CSS variables, light/dark themes, mobile-first |
| Backend  | Node.js, Express 5, Sequelize ORM, Socket.IO, JWT, Zod validation    |
| Database | SQLite by default (zero setup); PostgreSQL / MySQL via `DATABASE_URL` |

## Quick start

```bash
npm run install:all      # installs root, server and client dependencies
cp server/.env.example server/.env
npm run seed             # creates 37 demo users around Bengaluru + connections + a chat
npm run dev              # API on :4000, web app on :5173
```

Sign in with **demo@profilehub.dev / password123** (every seeded account uses `password123`).

To try it on a phone on the same Wi-Fi: `npm run dev:host` and open the "Network" URL Vite prints.
Note: browsers only allow location access on HTTPS or `localhost`, so test location from the laptop or put the app behind HTTPS.

## Features

- **Auth**: signup (2 steps with a profession picker) and login, JWT sessions, rate-limited auth routes.
- **Profiles**: role/title, profession category (Software, Doctor, Healthcare, Education, Design, Engineering, Legal, Finance, Marketing, Founder, Student, Creative, Other). Each category has its own colour and icon on badges, cards and profile covers. Also bio, skills, experience, city and photo URL.
- **Network**: send, accept, ignore, withdraw and remove connections. Connection count and mutual connections show on profiles. Invitations arrive in realtime with toasts and badges.
- **Discover filters**: search (name, role, skill, city), profession chips, distance radius (1 km up to any distance; bounding-box pre-filter plus haversine), online-now, and sort (recommended, nearest, newest, most connected). Infinite scroll.
- **Settings**: opt-in location sharing via the browser Geolocation API (turning it off deletes the coordinates), default discovery radius, show/hide online status, hide from Discover, and light/dark/system theme.
- **Chat (Socket.IO)**: messaging between connections only, live presence, typing indicator, read receipts, optimistic sending with retry, unread counts, history pagination, and sync across tabs and devices.
- **Privacy**: other members never receive exact coordinates, only a rounded distance.

## Project layout

```
server/src
  config/        env + Sequelize connection
  models/        User, Connection, Message (+ associations)
  routes/        auth, users (discover/profile/settings/location), connections, messages
  services/      relationship helpers, message sending
  socket/        Socket.IO auth, presence, typing, emit helpers
  seed.js        demo data
client/src
  components/ui  UiButton, UiInput, UiToggle, UiRange, UiSheet, UiTabs, UiAvatar, ...
  components/    ProfileCard, ConnectButton, FilterPanel, ProfessionPicker, chat/*
  stores/        auth, realtime (socket + presence), chat, theme
  views/         Discover, Profile, Network, Messages, Settings, Login, Signup
```

## Production

```bash
npm run build                            # builds client/dist
NODE_ENV=production JWT_SECRET=... npm start
```

The API serves the built app from the same origin. For PostgreSQL run `npm i pg pg-hstore` in `server/` and set `DATABASE_URL`.
Tables are created with `sequelize.sync()`. Switch to Sequelize migrations before you rely on the schema in production.
