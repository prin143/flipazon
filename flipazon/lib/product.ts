import type { Product } from "@/data/catalog";
import { isObject } from "@/lib/api";
import { IMAGES } from "@/lib/image-choices";

export const CATEGORY_IDS = [
  "electronics",
  "fashion",
  "home",
  "beauty",
  "sports",
  "accessories",
] as const;

export const productSelect = `id::int AS id,name,category,brand,price,original_price AS "originalPrice",rating::float AS rating,review_count AS "reviewCount",image,badge,badge_type AS "badgeType",color,description,stock`;

export type CatalogProduct = Product & { stock: number };

export function validateProduct(
  input: unknown
): { product: Record<string, string | number | null> } | { error: string } {
  if (!isObject(input)) {
    return { error: "Invalid product details" };
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const brand = typeof input.brand === "string" ? input.brand.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";

  const category = input.category;
  const price = input.price;
  const originalPrice = input.originalPrice;
  const stock = input.stock;
  const image = input.image;

  if (name.length < 3 || name.length > 160) {
    return { error: "Product name must be 3–160 characters" };
  }

  if (brand.length < 2 || brand.length > 80) {
    return { error: "Brand must be 2–80 characters" };
  }

  if (!CATEGORY_IDS.includes(category as typeof CATEGORY_IDS[number])) {
    return { error: "Invalid category" };
  }

  if (
    !Number.isInteger(price) ||
    Number(price) <= 0 ||
    Number(price) > 10000000
  ) {
    return { error: "Invalid price" };
  }

  if (
    !Number.isInteger(originalPrice) ||
    Number(originalPrice) < Number(price) ||
    Number(originalPrice) > 10000000
  ) {
    return {
      error: "Original price must be at least the sale price",
    };
  }

  if (
    !Number.isInteger(stock) ||
    Number(stock) < 0 ||
    Number(stock) > 100000
  ) {
    return { error: "Invalid stock quantity" };
  }

  const isBuiltInImage =
    typeof image === "string" && IMAGES.includes(image);

  const isUploadedImage =
    typeof image === "string" &&
    (
      /^\/uploads\/products\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(image) ||
      /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?flipazon\/products\/[a-f0-9-]{36}(?:\.(?:jpg|png|webp))?$/i.test(image)
    );

  if (!isBuiltInImage && !isUploadedImage) {
    return {
      error: "Choose a built-in image or upload a JPG, PNG, or WEBP image",
    };
  }

  if (description.length > 1500) {
    return { error: "Description is too long" };
  }

  return {
    product: {
      name,
      brand,
      category: category as string,
      price: Number(price),
      originalPrice: Number(originalPrice),
      stock: Number(stock),
      image,
      description,
    },
  };
}