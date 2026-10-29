import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { databaseError } from "@/lib/api";
import { productSelect, type CatalogProduct } from "@/lib/product";
export async function GET() {
  try {
    const result = await query<CatalogProduct>(`SELECT ${productSelect} FROM products WHERE active=true ORDER BY id`);
    return NextResponse.json({ products: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return databaseError(error); }
}
