import { createHmac, timingSafeEqual } from "node:crypto";
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

type PaymentOrder = {
  id: number;
  orderNumber: string;
  total: number;
  paymentStatus: string;
  paymentId: string | null;
};

type RazorpayPayment = {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
};

type VerifyResult =
  | { ok: true; orderNumber: string }
  | { ok: false; error: string; statusCode: number };

function authHeaders(keyId: string, secret: string) {
  return {
    Authorization:
      "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64"),
    "Content-Type": "application/json",
  };
}

export async function POST(request: NextRequest) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;

  try {
    const user = await currentUser();

    if (!user) {
      return errorJson("Please sign in before verifying payment.", 401);
    }

    const body = await jsonBody(request);

    if (!isObject(body)) {
      return errorJson("Invalid payment details.");
    }

    const razorpayOrderId = body.razorpay_order_id;
    const razorpayPaymentId = body.razorpay_payment_id;
    const razorpaySignature = body.razorpay_signature;

    if (
      typeof razorpayOrderId !== "string" ||
      !/^order_[A-Za-z0-9]+$/.test(razorpayOrderId) ||
      typeof razorpayPaymentId !== "string" ||
      !/^pay_[A-Za-z0-9]+$/.test(razorpayPaymentId) ||
      typeof razorpaySignature !== "string" ||
      !/^[a-f0-9]{64}$/i.test(razorpaySignature)
    ) {
      return errorJson("Invalid Razorpay payment response.");
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return errorJson("Online payment is not configured.", 503);
    }

    // Verify Razorpay's signature on the server.
    const expectedSignature = createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest();

    const receivedSignature = Buffer.from(razorpaySignature, "hex");

    if (
      expectedSignature.length !== receivedSignature.length ||
      !timingSafeEqual(expectedSignature, receivedSignature)
    ) {
      return errorJson("Payment signature verification failed.", 400);
    }

    // Find the order belonging to the signed-in customer.
    const order = await inTransaction<PaymentOrder | null>(async (client) => {
      const result = await client.query<PaymentOrder>(
        `SELECT
           id::int AS id,
           order_number AS "orderNumber",
           total::int AS total,
           payment_status AS "paymentStatus",
           razorpay_payment_id AS "paymentId"
         FROM orders
         WHERE user_id=$1
           AND razorpay_order_id=$2
           AND payment_method='razorpay'`,
        [user.id, razorpayOrderId],
      );

      return result.rows[0] ?? null;
    });

    if (!order) {
      return errorJson("Payment order was not found.", 404);
    }

    // Safe retry if the same payment was already verified.
    if (order.paymentStatus === "paid") {
      if (order.paymentId === razorpayPaymentId) {
        return NextResponse.json({
          ok: true,
          order: { orderNumber: order.orderNumber },
        });
      }

      return errorJson("This order has already been paid.", 409);
    }

    if (order.paymentStatus !== "pending") {
      return errorJson("This order is not awaiting payment.", 409);
    }

    // Confirm the payment directly with Razorpay.
    let paymentResponse: Response;

    try {
      paymentResponse = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`,
        {
          headers: authHeaders(keyId, keySecret),
          cache: "no-store",
        },
      );
    } catch {
      return errorJson("Could not connect to Razorpay. Please retry.", 502);
    }

    const payment = (await paymentResponse.json().catch(() => null)) as
      | RazorpayPayment
      | null;

    if (
      !paymentResponse.ok ||
      !payment ||
      payment.id !== razorpayPaymentId ||
      payment.order_id !== razorpayOrderId ||
      payment.amount !== order.total * 100 ||
      payment.currency !== "INR"
    ) {
      return errorJson("Razorpay payment details could not be verified.", 400);
    }

    if (payment.status !== "captured" && payment.status !== "authorized") {
      return errorJson("Payment has not been completed successfully.", 409);
    }

    const result = await inTransaction<VerifyResult>(async (client) => {
      const lockedOrder = await client.query<PaymentOrder>(
        `SELECT
           id::int AS id,
           order_number AS "orderNumber",
           total::int AS total,
           payment_status AS "paymentStatus",
           razorpay_payment_id AS "paymentId"
         FROM orders
         WHERE user_id=$1 AND razorpay_order_id=$2
         FOR UPDATE`,
        [user.id, razorpayOrderId],
      );

      const current = lockedOrder.rows[0];

      if (!current) {
        return {
          ok: false,
          error: "Order was not found.",
          statusCode: 404,
        };
      }

      if (current.paymentStatus === "paid") {
        if (current.paymentId === razorpayPaymentId) {
          return { ok: true, orderNumber: current.orderNumber };
        }

        return {
          ok: false,
          error: "This order has already been paid.",
          statusCode: 409,
        };
      }

      if (current.paymentStatus !== "pending") {
        return {
          ok: false,
          error: "This order is not awaiting payment.",
          statusCode: 409,
        };
      }

      // Lock products and check inventory before capturing an authorized payment.
      const itemsResult = await client.query<{
        product_id: number | null;
        quantity: number;
      }>(
        `SELECT product_id::int AS product_id, quantity
         FROM order_items
         WHERE order_id=$1
         ORDER BY product_id`,
        [current.id],
      );

      const items = itemsResult.rows;

      if (!items.length) {
        return {
          ok: false,
          error: "Order items were not found.",
          statusCode: 409,
        };
      }

      const productIds = items
        .map((item) => item.product_id)
        .filter((id): id is number => id !== null);

      const stockResult = await client.query<{
        id: number;
        stock: number;
      }>(
        `SELECT id::int AS id, stock::int AS stock
         FROM products
         WHERE id=ANY($1::bigint[])
         ORDER BY id
         FOR UPDATE`,
        [productIds],
      );

      const stockById = new Map(
        stockResult.rows.map((product) => [product.id, product.stock]),
      );

      const stockUnavailable = items.some(
        (item) =>
          item.product_id === null ||
          !stockById.has(item.product_id) ||
          (stockById.get(item.product_id) ?? 0) < item.quantity,
      );

      if (stockUnavailable) {
        // If Razorpay already captured the money, try to refund it.
        if (payment.status === "captured") {
          try {
            const refundResponse = await fetch(
              `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}/refund`,
              {
                method: "POST",
                headers: authHeaders(keyId, keySecret),
                body: JSON.stringify({
                  amount: current.total * 100,
                  notes: { reason: "Product stock unavailable" },
                }),
                cache: "no-store",
              },
            );

            if (refundResponse.ok) {
              await client.query(
                `UPDATE orders
                 SET status='cancelled',
                     payment_status='refunded',
                     razorpay_payment_id=$2,
                     updated_at=NOW()
                 WHERE id=$1`,
                [current.id, razorpayPaymentId],
              );

              return {
                ok: false,
                error: "Stock is unavailable. A refund has been initiated.",
                statusCode: 409,
              };
            }
          } catch {
            // Keep the order pending if refund could not be confirmed.
          }

          return {
            ok: false,
            error: "Payment was captured but stock is unavailable. Please contact Flipazon support.",
            statusCode: 409,
          };
        }

        return {
          ok: false,
          error: "Stock changed. Payment has not been captured. Please contact support.",
          statusCode: 409,
        };
      }

      // Capture an authorized payment only after confirming stock.
      if (payment.status === "authorized") {
        let captureResponse: Response;

        try {
          captureResponse = await fetch(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}/capture`,
            {
              method: "POST",
              headers: authHeaders(keyId, keySecret),
              body: JSON.stringify({
                amount: current.total * 100,
                currency: "INR",
              }),
              cache: "no-store",
            },
          );
        } catch {
          return {
            ok: false,
            error: "Payment capture could not be confirmed. Please retry.",
            statusCode: 502,
          };
        }

        const captureData = (await captureResponse.json().catch(() => null)) as
          | RazorpayPayment
          | null;

        if (
          !captureResponse.ok ||
          captureData?.status !== "captured" ||
          captureData.id !== razorpayPaymentId
        ) {
          return {
            ok: false,
            error: "Razorpay could not capture the payment. Please retry.",
            statusCode: 409,
          };
        }
      }

      // Deduct stock only after successful payment verification.
      for (const item of items) {
        const update = await client.query(
          `UPDATE products
           SET stock=stock-$1
           WHERE id=$2 AND stock >= $1
           RETURNING id`,
          [item.quantity, item.product_id],
        );

        if (!update.rows.length) {
          throw new Error("Stock changed during payment confirmation.");
        }
      }

      await client.query(
        `UPDATE orders
         SET status='confirmed',
             payment_status='paid',
             razorpay_payment_id=$2,
             updated_at=NOW()
         WHERE id=$1`,
        [current.id, razorpayPaymentId],
      );

      // Remove only the products included in this paid order.
      await client.query(
        `DELETE FROM cart_items ci
         USING order_items oi
         WHERE oi.order_id=$1
           AND ci.user_id=$2
           AND ci.product_id=oi.product_id`,
        [current.id, user.id],
      );

      return { ok: true, orderNumber: current.orderNumber };
    });

    if (!result.ok) {
      return errorJson(result.error, result.statusCode);
    }

    return NextResponse.json(
      {
        ok: true,
        order: { orderNumber: result.orderNumber },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return databaseError(error);
  }
}
