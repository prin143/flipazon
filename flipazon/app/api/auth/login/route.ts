import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { attachSessionCookie } from "@/lib/auth";
import { hashSessionToken, newSessionToken, SESSION_DAYS, verifyPassword } from "@/lib/security";
import { databaseError, errorJson, isObject, jsonBody, unsafeOrigin } from "@/lib/api";

type UserRow = { id: number; name: string; email: string; role: "customer" | "admin"; password_hash: string };
export async function POST(request: NextRequest) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;
  const body = await jsonBody(request);
  if (!isObject(body)) return errorJson("Enter your email and password.");
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || email.length > 254 || !password || Buffer.byteLength(password) > 256) return errorJson("Invalid email or password.", 401);
  try {
    const result = await query<UserRow>("SELECT id::int AS id,name,email,role,password_hash FROM users WHERE email=$1 LIMIT 1", [email]);
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) return errorJson("Invalid email or password.", 401);
    const token = newSessionToken();
    await query("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,NOW()+($3::integer * INTERVAL '1 day'))", [hashSessionToken(token),user.id,SESSION_DAYS]);
    const response = NextResponse.json({ user: { id:user.id,name:user.name,email:user.email,role:user.role } });
    attachSessionCookie(response, token);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) { return databaseError(error); }
}
