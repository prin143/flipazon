import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { query, inTransaction } from "@/lib/db";
import { databaseError, errorJson, isObject, jsonBody, unsafeOrigin } from "@/lib/api";

type CartRow = { id: number; quantity: number };
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return errorJson("Sign in to access saved cart", 401);
    const result = await query<CartRow>("SELECT product_id::int AS id,quantity FROM cart_items WHERE user_id=$1 ORDER BY product_id", [user.id]);
    return NextResponse.json({ cart: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return databaseError(error); }
}
export async function PUT(request: NextRequest) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;
  try {
    const user = await currentUser();
    if (!user) return errorJson("Sign in to save cart", 401);
    const body = await jsonBody(request);
    if (!isObject(body) || !Array.isArray(body.cart) || body.cart.length > 100) return errorJson("Invalid cart");
    const items: CartRow[] = [];
    for (const item of body.cart) {
      if (!isObject(item) || !Number.isSafeInteger(item.id) || Number(item.id) <= 0 || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 99) return errorJson("Invalid cart item");
      if (items.some((other) => other.id === item.id)) return errorJson("Duplicate product in cart");
      items.push({ id: Number(item.id), quantity: Number(item.quantity) });
    }
    if (items.length) {
      const ids = items.map((item) => item.id);
      const result = await query<{ id: number; stock: number }>("SELECT id::int,stock FROM products WHERE id=ANY($1::bigint[]) AND active=true", [ids]);
      const stocks = new Map(result.rows.map((item) => [item.id, item.stock]));
      if (items.some((item) => !stocks.has(item.id) || (stocks.get(item.id) ?? 0) < item.quantity)) return errorJson("Some cart items are unavailable or out of stock", 409);
    }
    await inTransaction(async (client) => {
      await client.query("DELETE FROM cart_items WHERE user_id=$1", [user.id]);
      for (const item of items) {
        await client.query("INSERT INTO cart_items(user_id,product_id,quantity) VALUES($1,$2,$3)",[user.id,item.id,item.quantity]);
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return databaseError(error); }
}
