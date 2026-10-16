# NightGuard Backend

Node.js + Express + SQLite API for the NightGuard frontend. Your frontend lives in `public/` (already wired to the API).

## Run
```bash
npm install
cp .env.example .env     # then set JWT_SECRET (see comment inside)
npm start                # http://localhost:3000  -> redirects to login.html
```
Requires Node 18+.

## Structure
```
src/server.js          app setup, security headers, rate limiting, static hosting
src/db.js              SQLite schema (users, trips, contacts, locations, sos_events)
src/auth.js            JWT sign + auth middleware
src/sms.js             optional Twilio SMS
src/routes/            auth, trips, contacts, sos, share
public/                index.html, style.css, script.js (patched), api.js, login.html, share.html
```

## API
| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | returns `{token, user}` |
| GET | /api/auth/me | current user |
| POST | /api/trips | save trip (ends previous active trip) |
| GET | /api/trips/active, /api/trips | active trip / history |
| POST | /api/trips/:id/complete | mark trip finished |
| POST | /api/trips/location | store `{latitude, longitude, accuracy}` |
| GET | /api/trips/location/last | last known location |
| GET/POST/DELETE | /api/contacts[/:id] | trusted contacts (max 10) |
| POST | /api/sos | log SOS; texts contacts if Twilio configured |
| GET | /api/share/:token | public read-only trip view (used by `share.html`) |

All routes except register/login/share need `Authorization: Bearer <token>`.

## SOS behaviour
- With Twilio vars set in `.env`, SOS texts every trusted contact (with map + trip link).
- Without them, the server only logs the event and the frontend falls back to opening the phone's SMS/share sheet, as before.
- It never calls emergency services. Keep the on-screen advice to call 112.

## Before going live
- Serve over HTTPS (geolocation and secure tokens need it); set `PUBLIC_URL`.
- Browsers can only send location while the page is open. Reliable background tracking needs a native app.
- Consider moving the JWT from localStorage to an httpOnly cookie, and adding password reset / email verification.
- Back up `data/nightguard.db`.
