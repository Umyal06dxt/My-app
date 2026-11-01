# Little Live 🎀

A cute little website that shows your live Tunyt events and sells tickets through the
[Tunyt Host API](https://www.tunyt.com/docs/host-api). Built with Next.js 16.

- **Home** (`/`): every approved event that hasn't ended, soonest first.
- **Event page** (`/events/[eventId]`): details, plus a ticket picker with counters, early-bird prices and "only N left".
- **Checkout**: the server creates a Tunyt checkout session and sends the buyer to Tunyt to sign in and pay
  (UPI, cards and more). Tunyt then sends them back here.
- **Thank you** (`/thanks`): asks Tunyt whether the session is really `PAID` (the redirect alone proves nothing) and shows confetti 🎉.
- **Webhook** (`/api/tunyt/webhook`): optional. Checks the signature of each Tunyt event and logs it.

Tunyt emails the tickets with their QR codes, so this site doesn't need a database.

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill it in
pnpm dev
```

| Variable | What it is |
| --- | --- |
| `SITE_URL` | Your site's public `https://` address, e.g. `https://shop.example.com`. Must be in the secret key's `allowedOrigins`. |
| `SITE_NAME` | The name shown in the header (default "Little Live"). |
| `TUNYT_SECRET_KEY` | `sk_live_...` with `checkout:write`. Server only. Never commit it. |
| `TUNYT_EVENTS_KEY` | A key with `events:read` for listing events: a `pk_live_...` key whose `allowedOrigins` include `SITE_URL`, or a secret key with `events:read`. Leave it empty if `TUNYT_SECRET_KEY` already has `events:read`. |
| `TUNYT_WEBHOOK_SECRET` | Optional `whsec_...` from registering `SITE_URL/api/tunyt/webhook`. |

### Your keys

A secret key with only `checkout:write`, `bookings:read` and `refunds:write` **can't list events**.
Add one of these:

- **Publishable key (simplest):** create a `PUBLISHABLE` / `LIVE` key with `allowedOrigins: ["<your SITE_URL>"]`
  and put it in `TUNYT_EVENTS_KEY`.
- **Or** create a new secret key with `events:read` and `checkout:write` (you can have 2 active secret keys per mode).

Return URLs must be `https` and on an origin in the secret key's `allowedOrigins`. For local testing,
use a tunnel (e.g. `cloudflared` or `ngrok`) and set `SITE_URL` to the tunnel address.

### Going live

Only `APPROVED`, general-admission events with ticketing turned on can be sold. Do one real purchase with a
free or cheap ticket, then refund it, before you share the site.
