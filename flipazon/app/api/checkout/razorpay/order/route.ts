import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  databaseError,
  errorJson,
  isObject,
  jsonBody,
  unsafeOrigin,
} from "@/lib/api";
import { inTransaction } from "@/lib/db";

export const runtime = "nodejs";

type CheckoutProduct = {
  id: number;
  quantity: number;
  name: string;
  brand: string;
  price: number;
  image: string;
  stock: number;
};

type CheckoutResult =
  | {
      ok: true;
      order: {
        orderNumber: string;
        razorpayOrderId: string;
        amount: number;
        currency: string;
        subtotal: number;
        shippingFee: number;
        total: number;
      };
    }
  | {
      ok: false;
      error: string;
      statusCode: number;
    };

type RazorpayOrderResponse = {
  id?: string;
  amount?: number;
  currency?: string;
};

function cleanText(value: unknown, max: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : "";
}

export async function POST(request: NextRequest) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return errorJson("Online payment is not configured on the server.", 503);
  }

  try {
    const user = await currentUser();

    if (!user) {
      return errorJson("Please sign in before checkout.", 401);
    }

    const body = await jsonBody(request);

    if (!isObject(body)) {
      return errorJson("Invalid checkout details.");
    }

    const customerName = cleanText(body.fullName, 80);
    const phone = cleanText(body.phone, 20)
      .replace(/[\s()-]/g, "")
      .replace(/^\+?91/, "");

    const addressLine1 = cleanText(body.addressLine1, 180);
    const addressLine2 = cleanText(body.addressLine2, 180);
    const city = cleanText(body.city, 80);
    const state = cleanText(body.state, 80);
    const postalCode = cleanText(body.postalCode, 6);

    if (customerName.length < 2) {
      return errorJson("Enter your full name.");
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return errorJson("Enter a valid 10-digit Indian mobile number.");
    }

    if (addressLine1.length < 5) {
      return errorJson("Enter a complete street address.");
    }

    if (!city || !state) {
      return errorJson("Enter your city and state.");
    }

    if (!/^\d{6}$/.test(postalCode)) {
      return errorJson("Enter a valid 6-digit PIN code.");
    }

    const result = await inTransaction<CheckoutResult>(async (client) => {
      const cartCountResult = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM cart_items
         WHERE user_id=$1`,
        [user.id],
      );

      const cartCount = cartCountResult.rows[0]?.count ?? 0;

      if (!cartCount) {
        return {
          ok: false,
          error: "Your cart is empty.",
          statusCode: 400,
        };
      }

      const cartResult = await client.query<CheckoutProduct>(
        `SELECT
           p.id::int AS id,
           ci.quantity,
           p.name,
           p.brand,
           p.price::int AS price,
           p.image,
           p.stock::int AS stock
         FROM cart_items ci
         JOIN products p ON p.id=ci.product_id
         WHERE ci.user_id=$1 AND p.active=true
         ORDER BY p.id
         FOR UPDATE OF ci, p`,
        [user.id],
      );

      const items = cartResult.rows;

      if (items.length !== cartCount) {
        return {
          ok: false,
          error: "One or more cart products are unavailable. Refresh your cart.",
          statusCode: 409,
        };
      }

      if (items.some((item) => item.quantity < 1 || item.stock < item.quantity)) {
        return {
          ok: false,
          error: "One or more products do not have enough stock.",
          statusCode: 409,
        };
      }

      const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      if (!Number.isSafeInteger(subtotal) || subtotal > 2_000_000_000) {
        return {
          ok: false,
          error: "Your order total is too high.",
          statusCode: 400,
        };
      }

      const shippingFee = subtotal >= 999 ? 0 : 49;
      const total = subtotal + shippingFee;
      const amount = total * 100;

      if (!Number.isSafeInteger(amount)) {
        return {
          ok: false,
          error: "Invalid payment amount.",
          statusCode: 400,
        };
      }

      const orderNumber =
        `FZ-${Date.now().toString(36).toUpperCase()}-` +
        randomBytes(4).toString("hex").toUpperCase();

      let gatewayResponse: Response;

      try {
        gatewayResponse = await fetch(
          "https://api.razorpay.com/v1/orders",
          {
            method: "POST",
            headers: {
              Authorization:
                "Basic " +
                Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              amount,
              currency: "INR",
              receipt: orderNumber,
              notes: {
                orderNumber,
                userId: String(user.id),
              },
            }),
            cache: "no-store",
          },
        );
      } catch {
        return {
          ok: false,
          error: "Could not connect to Razorpay. Please try again.",
          statusCode: 502,
        };
      }

      const gatewayData =
        (await gatewayResponse.json().catch(() => null)) as
          | RazorpayOrderResponse
          | null;

      if (
        !gatewayResponse.ok ||
        !gatewayData?.id ||
        gatewayData.amount !== amount ||
        gatewayData.currency !== "INR"
      ) {
        return {
          ok: false,
          error: "Razorpay could not create your payment order.",
          statusCode: 502,
        };
      }

      const orderResult = await client.query<{ id: number }>(
        `INSERT INTO orders (
           order_number,
           user_id,
           status,
           payment_method,
           payment_status,
           subtotal,
           shipping_fee,
           total,
           customer_name,
           customer_email,
           phone,
           address_line1,
           address_line2,
           city,
           state,
           postal_code,
           country,
           razorpay_order_id
         )
         VALUES (
           $1,$2,'placed','razorpay','pending',
           $3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'India',$14
         )
         RETURNING id::int AS id`,
        [
          orderNumber,
          user.id,
          subtotal,
          shippingFee,
          total,
          customerName,
          user.email,
          phone,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          gatewayData.id,
        ],
      );

      const orderId = orderResult.rows[0].id;

      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (
             order_id,
             product_id,
             product_name,
             brand,
             image,
             unit_price,
             quantity,
             line_total
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            orderId,
            item.id,
            item.name,
            item.brand,
            item.image,
            item.price,
            item.quantity,
            item.price * item.quantity,
          ],
        );
      }

      return {
        ok: true,
        order: {
          orderNumber,
          razorpayOrderId: gatewayData.id,
          amount,
          currency: "INR",
          subtotal,
          shippingFee,
          total,
        },
      };
    });

    if (!result.ok) {
      return errorJson(result.error, result.statusCode);
    }

    return NextResponse.json(
      {
        ok: true,
        keyId,
        order: result.order,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return databaseError(error);
  }
}
