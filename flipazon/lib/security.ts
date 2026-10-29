import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest } from "next/server";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "flipazon_session";
export const SESSION_DAYS = 7;

// scrypt hashes are never stored as raw passwords. Separate salt per account.
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${digest.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  const test = (await scrypt(password, salt, 64)) as Buffer;
  const original = Buffer.from(hash, "hex");
  return timingSafeEqual(test, original);
}
export const newSessionToken = () => randomBytes(32).toString("base64url");
export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Allows normal same-origin browser forms; rejects cross-site Origin on writes.
export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients: session cookie still required.
  const target = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const acceptable = [target.origin];
  if (forwardedHost && forwardedProto && /^(https|http)$/.test(forwardedProto)) {
    acceptable.push(`${forwardedProto}://${forwardedHost}`);
  }
  return acceptable.includes(origin);
}
