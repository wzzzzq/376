# iClicker tool

Auto-logs in to the iClicker student portal with a headless Chromium browser,
captures the API bearer token, and fetches your profile and courses from the
iClicker API.

## How it works

iClicker's web app (student.iclicker.com) is a single-page app that talks to a
REST API at `api.iclicker.com`. Every data request carries an
`Authorization: Bearer <JWT>` header. `login.js` drives the real login form in
Chromium, waits for the app to make its first authenticated request, and grabs
that token. `fetch.js` then reuses the token to call the API directly — no
browser needed.

Login is plain email + password (no university SSO), so it runs fully headless.

## Setup

```bash
cp .env.example .env     # then edit .env with your iClicker email + password
npm install              # installs playwright-core (browser is already on the machine)
```

`.env`, `auth.json`, and `out/` are gitignored — your password and token never
get committed.

## Usage

```bash
node login.js            # logs in, saves token to auth.json
node fetch.js            # prints profile + courses, writes raw JSON to out/
```

Watch it log in instead of running headless:

```bash
HEADED=1 node login.js
```

## Notes

- **Token lifetime:** tokens last ~24h. When `fetch.js` reports the token
  expired, just run `node login.js` again.
- **Browser path:** defaults to `/opt/pw-browsers/chromium`. Override with
  `CHROME_PATH=/path/to/chrome` if yours is elsewhere (e.g. on macOS,
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).
- **Proxy:** if `HTTPS_PROXY` is set it's passed to the browser automatically.

## API endpoints used

- `GET https://api.iclicker.com/trogon/v4/profile` — account profile
- `GET https://api.iclicker.com/v1/users/{userId}/views/student-courses` — enrolled courses

The captured token works for any other iClicker endpoint too — add more calls to
`fetch.js` as needed (e.g. per-course attendance or gradebook views).
