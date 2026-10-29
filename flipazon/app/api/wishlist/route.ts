import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { query, inTransaction } from "@/lib/db";
import { databaseError, errorJson, isObject, jsonBody, unsafeOrigin } from "@/lib/api";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return errorJson("Sign in to access wishlist", 401);
    const result = await query<{ id: number }>("SELECT product_id::int AS id FROM wishlist_items WHERE user_id=$1 ORDER BY product_id",[user.id]);
    return NextResponse.json({ wishlist: result.rows.map((item) => item.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return databaseError(error); }
}
export async function PUT(request: NextRequest) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;
  try {
    const user = await currentUser();
    if (!user) return errorJson("Sign in to save wishlist", 401);
    const body = await jsonBody(request);
    if (!isObject(body) || !Array.isArray(body.wishlist) || body.wishlist.length > 100 || body.wishlist.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) <= 0)) return errorJson("Invalid wishlist");
    const ids = [...new Set(body.wishlist as number[])];
    if (ids.length) {
      const result = await query<{ id: number }>("SELECT id::int FROM products WHERE id=ANY($1::bigint[]) AND active=true",[ids]);
      if (result.rows.length !== ids.length) return errorJson("Wishlist includes unavailable products", 409);
    }
    await inTransaction(async (client) => {
      await client.query("DELETE FROM wishlist_items WHERE user_id=$1",[user.id]);
      for (const id of ids) await client.query("INSERT INTO wishlist_items(user_id,product_id) VALUES($1,$2)",[user.id,id]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return databaseError(error); }
}
