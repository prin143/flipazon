import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Next loads .env.local itself; standalone scripts need to load it explicitly.
try { process.loadEnvFile(resolve(root, ".env.local")); } catch {}
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Copy .env.example to .env.local first.");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(readFileSync(resolve(root, "db/schema.sql"), "utf8"));
  const products = JSON.parse(readFileSync(resolve(root, "db/seed-products.json"), "utf8"));
  for (const product of products) {
    await pool.query(
      `INSERT INTO products (id,name,category,brand,price,original_price,rating,review_count,image,badge,badge_type,color,description,stock)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,25)
       ON CONFLICT (id) DO NOTHING`,
      [product.id,product.name,product.category,product.brand,product.price,product.originalPrice,product.rating,product.reviewCount,product.image,product.badge ?? null,product.badgeType ?? null,product.color,product.description],
    );
  }
  await pool.query("SELECT setval(pg_get_serial_sequence('products', 'id'), GREATEST((SELECT MAX(id) FROM products), 1), true)");
  console.log(`Database ready: ${products.length} seed products (existing products preserved).`);
} catch (error) {
  console.error("Database setup failed:", error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
