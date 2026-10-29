import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { databaseError, errorJson, jsonBody, unsafeOrigin } from "@/lib/api";
import { validateProduct, productSelect, type CatalogProduct } from "@/lib/product";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user || user.role !== "admin") return errorJson("Admin access required",403);
    const result = await query<CatalogProduct>(`SELECT ${productSelect} FROM products WHERE active=true ORDER BY id DESC`);
    return NextResponse.json({ products: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return databaseError(error); }
}
export async function POST(request: NextRequest) {
  const originError = unsafeOrigin(request);
  if (originError) return originError;
  try {
    const user = await currentUser();
    if (!user || user.role !== "admin") return errorJson("Admin access required",403);
    const parsed = validateProduct(await jsonBody(request));
    if ("error" in parsed) return errorJson(parsed.error);
    const p = parsed.product;
    const result = await query<CatalogProduct>(
      `INSERT INTO products(name,category,brand,price,original_price,image,description,stock)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${productSelect}`,
      [p.name,p.category,p.brand,p.price,p.originalPrice,p.image,p.description,p.stock],
    );
    return NextResponse.json({ product: result.rows[0] },{ status:201 });
  } catch (error) { return databaseError(error); }
}
