import "server-only";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { hashSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/security";
import type { NextResponse } from "next/server";

type UserRow = { id: number; name: string; email: string; role: "customer" | "admin" };

export async function currentUser(): Promise<UserRow | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 256) return null;
  const result = await query<UserRow>(
    `SELECT u.id::int AS id, u.name, u.email, u.role FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1`,
    [hashSessionToken(token)],
  );
  return result.rows[0] ?? null;
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}
export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0,
  });
}
