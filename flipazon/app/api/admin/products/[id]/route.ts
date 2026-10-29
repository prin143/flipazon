import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { databaseError, errorJson, jsonBody, unsafeOrigin } from "@/lib/api";
import { productSelect, validateProduct, type CatalogProduct } from "@/lib/product";

type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Params) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;
  try {
    const user = await currentUser();
    if (!user || user.role !== "admin") return errorJson("Admin access required",403);
    const id = Number((await params).id);
    if (!Number.isSafeInteger(id) || id < 1) return errorJson("Invalid product ID");
    const parsed = validateProduct(await jsonBody(request));
    if ("error" in parsed) return errorJson(parsed.error);
    const p = parsed.product;
    const result = await query<CatalogProduct>(
      `UPDATE products SET name=$1,category=$2,brand=$3,price=$4,original_price=$5,image=$6,description=$7,stock=$8
       WHERE id=$9 AND active=true RETURNING ${productSelect}`,
      [p.name,p.category,p.brand,p.price,p.originalPrice,p.image,p.description,p.stock,id],
    );
    if (!result.rowCount) return errorJson("Product not found",404);
    return NextResponse.json({ product: result.rows[0] });
  } catch (error) { return databaseError(error); }
}
export async function DELETE(request: NextRequest, { params }: Params) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;
  try {
    const user = await currentUser();
    if (!user || user.role !== "admin") return errorJson("Admin access required",403);
    const id = Number((await params).id);
    if (!Number.isSafeInteger(id) || id < 1) return errorJson("Invalid product ID");
    const result = await query("UPDATE products SET active=false WHERE id=$1 AND active=true", [id]);
    if (!result.rowCount) return errorJson("Product not found",404);
    // Clean up unpurchasable product from all customers' saved lists.
    await query("DELETE FROM cart_items WHERE product_id=$1",[id]);
    await query("DELETE FROM wishlist_items WHERE product_id=$1",[id]);
    return NextResponse.json({ ok:true });
  } catch (error) { return databaseError(error); }
}
