# Velavan Transport

Private fleet-tracking app for Velavan Transport, built on OneLap telematics and Supabase.
It is a responsive web app that can be installed on a phone (PWA: browser menu → *Add to Home screen*).

## What it does

**Owner login** (email + password)
- Dashboard: total km this month, running / idle / stopped hours, live status of every vehicle, charts per day and per vehicle
- Live map of all vehicles, refreshed every 10 seconds
- Vehicle page: live speed, ignition, battery, GSM, odometer, monthly report, route replay with speed chart
- Drivers: create a driver login (mobile number + password), assign a vehicle, reset password, disable, delete
- Vehicles: import all devices from OneLap, edit registration numbers

**Driver login** (mobile number + password set by the owner)
- Sees only the vehicle assigned to them: live position, monthly report, route replay

## How it fits together

```
Phone / browser ──► Supabase Auth + Postgres (profiles, vehicles, RLS)
        │
        └────────► Edge function "onelap"  ──► OneLap API (web.onelap.in/api)
                   Edge function "drivers" ──► Supabase Auth admin (create driver logins)
```

The OneLap login is stored only as a Supabase secret and is used server-side. Owners can query every
vehicle in their fleet; drivers can query only their assigned vehicle (checked on the server).

## Try it on your computer

You need [Node.js 20+](https://nodejs.org) and Git.

```bash
git clone https://github.com/Tamilkesavan/velavan-transport.git
cd velavan-transport
npm install
```

**Demo mode** (sample data, nothing else to set up):

```bash
npm run demo
```

Open http://localhost:5173. Owner tab: any email and password. Driver tab: `9876543210` with any password.
Drivers you add in demo mode are kept until you reload the page.

**With your real data** (after steps 1–3 of the one-time setup below, no hosting needed):

```bash
cp .env.production .env.local
npm run dev
```

Open http://localhost:5173 and sign in with your owner account.

## One-time setup

1. **Supabase secrets** (Dashboard → Edge Functions → Secrets):
   - `ONELAP_PHONE` – the registered OneLap mobile number
   - `ONELAP_PASSWORD` – the OneLap password
2. **GitHub secrets** (repo Settings → Secrets and variables → Actions):
   - `SUPABASE_ACCESS_TOKEN` – from https://supabase.com/dashboard/account/tokens
   - `SUPABASE_DB_PASSWORD` – the database password chosen when the project was created

   Then run the **Deploy Supabase** workflow (Actions tab → Deploy Supabase → Run workflow).
   It creates the tables and deploys both edge functions.
3. **Owner account** (Dashboard → Authentication → Users → Add user): your email + a password,
   tick *Auto confirm*. Then Authentication → Sign In / Providers → turn **off** *Allow new users to sign up*.
4. **Hosting**: import this repo at https://vercel.com/new (framework: Vite). No settings needed;
   the public Supabase URL and anon key are in `.env.production`.
5. Sign in as owner → **Vehicles** → **Import from OneLap** → **Drivers** → **Add driver**.

## Notes on the numbers

- Distance uses the device odometer (`totalDistance`) when available, otherwise GPS points.
- Running = speed ≥ 5 km/h; idle = ignition on and slower; stopped = the rest of the day.
  Gaps over 20 minutes without data count as stopped.
- OneLap is Traccar-based and reports speed in knots; the function converts to km/h
  (override with the `ONELAP_SPEED_FACTOR` secret if speeds look wrong, e.g. `1`).
- Finished days are cached in `daily_stats`, so month views stay fast.
