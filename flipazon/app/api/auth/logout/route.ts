import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie } from "@/lib/auth";
import { query } from "@/lib/db";
import { hashSessionToken, SESSION_COOKIE } from "@/lib/security";
import { databaseError, unsafeOrigin } from "@/lib/api";

export async function POST(request: NextRequest) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    if (token) await query("DELETE FROM sessions WHERE token_hash=$1", [hashSessionToken(token)]);
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) { return databaseError(error); }
}
