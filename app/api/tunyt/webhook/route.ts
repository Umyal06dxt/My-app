import crypto from "node:crypto";

/**
 * Tunyt webhook receiver. Register https://<your-site>/api/tunyt/webhook in Tunyt and put
 * the whsec_ secret in TUNYT_WEBHOOK_SECRET. Tunyt itself emails the tickets, so this only
 * verifies and logs; add your own handling (e.g. a database or notifications) where marked.
 */
export async function POST(req: Request) {
  const secret = process.env.TUNYT_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret not configured", { status: 503 });

  const raw = await req.text(); // raw body: re-serialised JSON would break the signature
  if (!verify(raw, req.headers.get("Tunyt-Signature") ?? "", secret)) {
    return new Response("Bad signature", { status: 400 });
  }

  const event = JSON.parse(raw) as { id: string; type: string; mode: string; data: Record<string, unknown> };
  // Events can repeat and arrive out of order: whatever you add here must be safe to run twice.
  console.log("[tunyt webhook]", event.type, event.id, event.mode, JSON.stringify(event.data));

  return new Response(null, { status: 200 });
}

function verify(raw: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false; // replay guard
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
