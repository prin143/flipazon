import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/security";

export const errorJson = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
export const unsafeOrigin = (request: NextRequest) => !isSameOrigin(request) ? errorJson("Cross-origin request rejected", 403) : null;
export const databaseError = (error: unknown) => {
  console.error("Flipazon API error:", error);
  return errorJson("Database unavailable or not initialized. See START-HERE-HINDI.md", 503);
};
export async function jsonBody(request: NextRequest) {
  try { return await request.json() as unknown; } catch { return null; }
}
export function isObject(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}
