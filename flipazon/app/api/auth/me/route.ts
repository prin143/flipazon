import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { databaseError } from "@/lib/api";
export async function GET() {
  try {
    const user = await currentUser();
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return databaseError(error); }
}
