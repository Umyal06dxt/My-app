# Little Live 🎀

A cute little website that shows your live Tunyt events and sells tickets through the
[Tunyt Host API](https://www.tunyt.com/docs/host-api). Built with Next.js 16.

- **Home** (`/`): every approved event that hasn't ended, soonest first.
- **Event page** (`/events/[eventId]`): details, plus a ticket picker with counters, early-bird prices and "only N left".
- **Checkout, on your own site**: the server creates a Tunyt checkout session, then a pop-up on the event page
  asks for the buyer's phone or email, checks the code Tunyt sends, and shows Tunyt's payment frame (UPI, cards
  and more). When the frame reports `paid`, the buyer goes to `/thanks`. There's always a "pay on tunyt.com
  instead" link, and `CHECKOUT_MODE=hosted` sends everyone to tunyt.com instead.
- **Thank you** (`/thanks`): asks Tunyt whether the session is really `PAID` (the redirect alone proves nothing), shows confetti 🎉
  and the buyer's tickets with QR codes. Tickets only show in the browser that made the purchase (for 30 days).
- **Admin** (`/admin`): password-protected. Bookings per event with buyer name, email and phone, refunds (whole booking
  or one ticket), resending tickets, and your earnings and next payout.
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
| `TUNYT_SECRET_KEY` | `sk_live_...` with all scopes (or at least `checkout:write`, `bookings:read`, `refunds:write`, `tickets:write`, `payouts:read`, `events:read`). Server only. Never commit it. |
| `TUNYT_EVENTS_KEY` | A key with `events:read` for listing events: a `pk_live_...` key whose `allowedOrigins` include `SITE_URL`, or a secret key with `events:read`. Leave it empty if `TUNYT_SECRET_KEY` already has `events:read`. |
| `CHECKOUT_MODE` | Optional. `hosted` sends buyers to tunyt.com to pay; leave empty to pay on your site. |
| `ADMIN_PASSWORD` | Password for `/admin`, at least 8 characters. Admin is off until it's set. |
| `TUNYT_WEBHOOK_SECRET` | Optional `whsec_...` from registering `SITE_URL/api/tunyt/webhook`. |

### Your keys

A secret key with only `checkout:write`, `bookings:read` and `refunds:write` **can't list events**.
Add one of these:

- **Publishable key (simplest):** create a `PUBLISHABLE` / `LIVE` key with `allowedOrigins: ["<your SITE_URL>"]`
  and put it in `TUNYT_EVENTS_KEY`.
- **Or** create a new secret key with `events:read` and `checkout:write` (you can have 2 active secret keys per mode).

The on-site login only works from the exact address in `SITE_URL` (Tunyt checks the page's origin against the
session's return URLs), so open the site at that address. For example, if `SITE_URL` has no `www.`, use it without `www.` too.

Return URLs must be `https` and on an origin in the secret key's `allowedOrigins`. For local testing,
use a tunnel (e.g. `cloudflared` or `ngrok`) and set `SITE_URL` to the tunnel address.

### Going live

Only `APPROVED`, general-admission events with ticketing turned on can be sold. Do one real purchase with a
free or cheap ticket, then refund it, before you share the site.
