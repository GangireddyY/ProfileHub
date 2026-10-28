# ProfileHUB

A professional network and local marketplace with **location-based discovery**, **150+ professions** (from software developers to drivers, electricians and daily wage workers), **hourly/daily rates**, **buy & sell listings**, **connection requests** and **realtime chat**.

## Stack

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | Vue 3 (Composition API), Vite, Pinia, Vue Router, socket.io-client   |
| UI       | Custom component library (`frontend/src/components/ui`), CSS variables, light/dark themes, mobile-first |
| Backend  | Node.js, Express 5, Sequelize ORM, Socket.IO, cookie sessions, Zod validation |
| Database | SQLite by default (zero setup); PostgreSQL / MySQL via `DATABASE_URL` |

## Quick start

```bash
npm run install:all      # installs root, backend and frontend dependencies
cp backend/.env.example backend/.env   # then set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME
npm run dev              # API on :4000, web app on :5173
```

There is no sample data: the database starts with the profession list, the default Free plan and the admin account from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`, created on first start. That password is only used for the first creation,
so change it in Settings and remove it from `.env`. An existing member account with that email is never promoted.

New sign-ups are **members waiting for approval**: they can't sign in until an admin approves them in Admin panel ? Approvals.
Admins can promote approved members to admin from the Users tab.

To try it on a phone on the same Wi-Fi, run `npm run dev:host` and open the `https://…` "Network" URL Vite prints.
It uses a self-signed certificate (accept the browser warning once) because phones only allow location access over HTTPS.

## Features

- **Auth & sessions**: sign-up with admin approval, sign-in with server-side sessions in httpOnly cookies (one per tab, so tabs can use different accounts), CSRF protection, 14-day idle / 60-day maximum expiry, "Where you're signed in" with per-session sign-out, and rate limits on sign-up, sign-in, messages, invitations, search, uploads and requests.
- **Professions**: a catalog of 150+ professions in 17 categories (technology, healthcare, skilled trades, construction & labour, driving & transport, machine operators, home services, hospitality, farming, retail, security…), stored in the database. Each has its own colour and icon on badges, cards and profile covers. If a profession is missing, members can request it (at signup or in settings); admins approve or decline requests, and approving also resolves duplicate requests and notifies everyone who asked.
- **Rates & availability**: members set a rate per hour, day, job or month (INR, USD, EUR, GBP, AED) and an "available for work" flag. Both show on cards and profiles and can be filtered and sorted in Discover.
- **Marketplace**: sell vehicles, bikes, phones, electronics, furniture, appliances, books and more. Up to 8 photos per listing (re-encoded to WebP), condition, negotiable price, distance from you, mark as sold, hide or delete. Buyers can message a seller without being connected first.
- **Search**: one search box for people, professions and listings ("driver" finds every kind of driver, "bike" finds bikes and scooters).
- **Admin panel** (`/admin`): approvals, users (edit, role, suspend, delete), member reports, listing moderation (hide or delete with a reason sent to the seller), plans and plan requests, profession requests and the profession catalog. Bulk approve / decline / suspend / reactivate / change plan / delete, CSV export of users, listings and the activity log, and an **activity log** of every admin action (who did what, when, with before/after values), also shown per member in the account sheet.
- **Email (SendGrid)**: email confirmation at sign-up, "Forgot password" with one-time reset links (1 hour), and emails for approval, decline, suspension, password changes, new messages while you're away (at most one per chat every 30 minutes), invitations, reviews, plans and moderation. Without `SENDGRID_API_KEY` emails are printed to the backend console.
- **Push notifications**: Web Push with a service worker (`frontend/public/sw.js`); members turn it on per device in Settings → Notifications and choose per category (messages, network, plans, account, admin) for email and push separately. Needs `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`) and HTTPS in production.
- **Reviews & ratings**: connected members, or members who have chatted both ways, can leave one 1–5 star review each (editable). Averages show on cards, profiles and Discover ("Highest rated" sort); reviews can be reported and admins can remove them.
- **Languages**: English, हिन्दी (Hindi), ಕನ್ನಡ (Kannada), తెలుగు (Telugu), தமிழ் (Tamil) and മലയാളം (Malayalam) for the main screens (navigation, sign-in, Discover, Market, chat, notifications, settings), with a switcher on the sign-in page, in the account menu and in Settings. The choice is saved to the account.
- **Safety**: report profiles, listings and conversations; block members (no contact or visibility either way); "Download my data"; chat warnings when OTPs, PINs or bank details come up; plan-expiry reminders.
- **Profiles**: role/title, profession, rate, bio, skills, city, items for sale, and an experience and education timeline you can add to, edit and delete.
- **Profile photos**: upload JPG/PNG/WebP/GIF/AVIF up to 5 MB. The server crops and re-encodes every upload to a 400×400 WebP with `sharp`, and deletes the old file when you replace or remove it.
- **Network**: send, accept, ignore, withdraw and remove connections. Connection count and mutual connections show on profiles. Invitations arrive in realtime with toasts and badges.
- **Notifications**: bell with unread badge. Invitations can be accepted right from the list, and "accepted" notices link to chat.
- **Account security**: change password (this signs out every other device and socket) and delete your account after confirming your password. Both routes are rate limited.
- **Discover filters**: search (name, role, skill, city), profession chips, distance radius (1 km up to any distance; bounding-box pre-filter plus haversine), online-now, and sort (recommended, nearest, newest, most connected). Infinite scroll.
- **Settings**: opt-in location sharing via the browser Geolocation API (turning it off deletes the coordinates), default discovery radius, show/hide online status, hide from Discover, and light/dark/system theme.
- **Chat (Socket.IO)**: messaging between connections (or with sellers who have an active listing), live presence, typing indicator, read receipts, optimistic sending with retry, unread counts, history pagination, and sync across tabs and devices. Send up to 4 photos at a time (re-encoded to WebP, location data stripped), edit messages for 15 minutes, delete messages for everyone, and delete a conversation for yourself.
- **Privacy**: other members never receive exact coordinates, only a rounded distance.

## Project layout

```
backend/src
  config/        env + Sequelize connection
  db/            Umzug migrator + migrations/
  models/        User, Connection, Message, Experience, Notification, Profession, ProfessionRequest, Listing
  routes/        auth, users, account, connections, messages, notifications, professions, listings, search, admin
  services/      relationships, messages, notifications, avatars, experiences, professions, listing images, search
  socket/        Socket.IO auth, presence, typing, emit helpers
frontend/src
  components/ui      UiButton, UiInput, UiToggle, UiRange, UiSheet, UiTabs, UiAvatar, ...
  components/        ProfileCard, ConnectButton, FilterPanel, ProfessionPicker, chat/*, profile/*
  stores/            auth, realtime (socket + presence), chat, theme
  views/             Discover, Search, Market, Listing, ListingEditor, Profile, Network, Messages, Notifications, Settings, Admin, Login, Signup
```

## Database migrations

The schema lives in `backend/src/db/migrations`, and the server applies any pending migrations when it starts (the applied list is kept in the `SequelizeMeta` table).
To change the schema, add a new file such as `002-add-something.js` that exports `up` and `down`, and register it in `backend/src/db/migrator.js`. Never edit a migration that has already shipped.

## Production

```bash
npm run build                            # builds frontend/dist
NODE_ENV=production npm start          # session cookies are HTTPS-only in production
```

The API serves the built app from the same origin. For PostgreSQL run `npm i pg pg-hstore` in `backend/` and set `DATABASE_URL`.
Uploaded photos are stored in `backend/uploads` (change it with `UPLOAD_DIR`). Point that at persistent storage when you deploy.
