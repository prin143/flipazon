import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { databaseError, errorJson } from "@/lib/api";
import { query } from "@/lib/db";

type AdminOrder = { id:number; orderNumber:string; status:string; paymentMethod:string; paymentStatus:string; subtotal:number; shippingFee:number; total:number; customerName:string; customerEmail:string; phone:string; addressLine1:string; addressLine2:string; city:string; state:string; postalCode:string; createdAt:string };
type AdminItem = { orderId:number; name:string; brand:string; image:string; unitPrice:number; quantity:number; lineTotal:number };

export async function GET() {
  try {
    const user = await currentUser();
    if (!user || user.role !== "admin") return errorJson("Admin access required", 403);
    const ordersResult = await query<AdminOrder>(
      `SELECT id::int AS id,order_number AS "orderNumber",status,payment_method AS "paymentMethod",
       payment_status AS "paymentStatus",subtotal::int AS subtotal,shipping_fee::int AS "shippingFee",
       total::int AS total,customer_name AS "customerName",customer_email AS "customerEmail",phone,
       address_line1 AS "addressLine1",address_line2 AS "addressLine2",city,state,postal_code AS "postalCode",
       created_at AS "createdAt" FROM orders ORDER BY created_at DESC LIMIT 100`,
    );
    const orders = ordersResult.rows;
    if (!orders.length) return NextResponse.json({ orders: [] }, { headers: { "Cache-Control": "no-store" } });
    const itemsResult = await query<AdminItem>(
      `SELECT order_id::int AS "orderId",product_name AS name,brand,image,unit_price::int AS "unitPrice",
       quantity,line_total::int AS "lineTotal" FROM order_items WHERE order_id=ANY($1::bigint[]) ORDER BY id`,
      [orders.map((order) => order.id)],
    );
    const byOrder = new Map<number, AdminItem[]>();
    for (const item of itemsResult.rows) byOrder.set(item.orderId, [...(byOrder.get(item.orderId) ?? []), item]);
    return NextResponse.json({ orders: orders.map((order) => ({ ...order, items: byOrder.get(order.id) ?? [] })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return databaseError(error); }
}
