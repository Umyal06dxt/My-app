import "server-only";
import { cookies } from "next/headers";

/** This browser's recent checkout order ids, so /thanks can show tickets only to the buyer. */
const NAME = "tunyt_orders";
const MAX = 10;

export async function myOrderIds(): Promise<string[]> {
  const jar = await cookies();
  const ids: string[] = [];
  try {
    const parsed = JSON.parse(jar.get(NAME)?.value ?? "[]");
    if (Array.isArray(parsed)) ids.push(...parsed.filter((x) => typeof x === "string"));
  } catch {}
  const legacy = jar.get("tunyt_order")?.value;
  if (legacy) ids.push(legacy);
  return ids;
}

/** Only callable from a Server Action or Route Handler. */
export async function rememberOrder(orderId: string) {
  const ids = [orderId, ...(await myOrderIds()).filter((x) => x !== orderId)].slice(0, MAX);
  (await cookies()).set(NAME, JSON.stringify(ids), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
