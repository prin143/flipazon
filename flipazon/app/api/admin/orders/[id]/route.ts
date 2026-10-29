import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { databaseError, errorJson, isObject, jsonBody, unsafeOrigin } from "@/lib/api";
import { inTransaction } from "@/lib/db";

type OrderStatus = "placed" | "confirmed" | "shipped" | "delivered" | "cancelled";
type StatusUpdateResult = { ok: true; status: OrderStatus } | { ok: false; error: string; statusCode: number };
const transitions: Record<OrderStatus, OrderStatus[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;
  try {
    const user = await currentUser();
    if (!user || user.role !== "admin") return errorJson("Admin access required", 403);
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return errorJson("Invalid order ID");
    const body = await jsonBody(request);
    if (!isObject(body) || !["placed","confirmed","shipped","delivered","cancelled"].includes(String(body.status))) return errorJson("Invalid order status");
    const nextStatus = String(body.status) as OrderStatus;

    const result = await inTransaction<StatusUpdateResult>(async (client) => {
      const found = await client.query<{ status: OrderStatus }>("SELECT status FROM orders WHERE id=$1 FOR UPDATE", [id]);
      const current = found.rows[0]?.status;
      if (!current) return { ok: false, error: "Order not found", statusCode: 404 };
      if (!transitions[current].includes(nextStatus)) return { ok: false, error: `Cannot change an order from ${current} to ${nextStatus}`, statusCode: 409 };
      if (nextStatus === "cancelled") {
        const items = await client.query<{ productId: number | null; quantity: number }>(
          "SELECT product_id::int AS \"productId\",quantity FROM order_items WHERE order_id=$1", [id],
        );
        for (const item of items.rows) {
          if (item.productId !== null) await client.query("UPDATE products SET stock=stock+$1 WHERE id=$2", [item.quantity,item.productId]);
        }
      }
      await client.query("UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2", [nextStatus,id]);
      return { ok: true, status: nextStatus };
    });
    if (!result.ok) return errorJson(result.error, result.statusCode);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return databaseError(error); }
}
