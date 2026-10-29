import { NextResponse, type NextRequest } from "next/server";
import { query, inTransaction } from "@/lib/db";
import { hashPassword, hashSessionToken, newSessionToken, SESSION_DAYS } from "@/lib/security";
import { attachSessionCookie } from "@/lib/auth";
import { databaseError, errorJson, isObject, jsonBody, unsafeOrigin } from "@/lib/api";

export async function POST(request: NextRequest) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;
  const body = await jsonBody(request);
  if (!isObject(body)) return errorJson("Enter valid signup details.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2 || name.length > 80) return errorJson("Name must be between 2 and 80 characters.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorJson("Enter a valid email address.");
  if (password.length < 10 || Buffer.byteLength(password) > 256) return errorJson("Use a password of 10–256 bytes.");
  try {
    const passwordHash = await hashPassword(password);
    const token = newSessionToken();
    const user = await inTransaction(async (client) => {
      const created = await client.query<{ id: number; name: string; email: string; role: string }>(
        "INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id::int AS id,name,email,role",
        [name,email,passwordHash],
      );
      const account = created.rows[0];
      await client.query("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,NOW()+($3::integer * INTERVAL '1 day'))", [hashSessionToken(token), account.id, SESSION_DAYS]);
      return account;
    });
    const response = NextResponse.json({ user }, { status: 201 });
    attachSessionCookie(response, token);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (isObject(error) && error.code === "23505") return errorJson("An account with this email already exists.", 409);
    return databaseError(error);
  }
}
