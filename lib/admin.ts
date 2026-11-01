import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "admin_session";

export function adminEnabled() {
  return (process.env.ADMIN_PASSWORD ?? "").length >= 8;
}

/** Session token derived from the password: changing ADMIN_PASSWORD logs everyone out. */
export function adminToken() {
  return crypto.createHmac("sha256", process.env.ADMIN_PASSWORD!).update("tunyt-admin-v1").digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function isAdmin() {
  if (!adminEnabled()) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!value && safeEqual(value, adminToken());
}

/** Call at the top of every admin page and admin Server Action. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
