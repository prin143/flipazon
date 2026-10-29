import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { databaseError, errorJson } from "@/lib/api";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user || user.role !== "admin") return errorJson("Admin access required", 403);
    const result = await query<{ users: number; products: number; stock: number }>(
      `SELECT (SELECT COUNT(*)::int FROM users) AS users,
              (SELECT COUNT(*)::int FROM products WHERE active=true) AS products,
              (SELECT COALESCE(SUM(stock),0)::int FROM products WHERE active=true) AS stock`,
    );
    return NextResponse.json({ stats: result.rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return databaseError(error); }
}
