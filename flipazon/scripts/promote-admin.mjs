import pg from "pg";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
try { process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local")); } catch {}
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error("Usage: npm run admin:promote -- you@example.com (register first)"); process.exit(1);
}
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL missing"); process.exit(1); }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query("UPDATE users SET role='admin' WHERE email=$1 RETURNING id,email", [email]);
  if (!result.rowCount) { console.error("User not found. Sign up on Flipazon first."); process.exitCode = 1; }
  else console.log(`Admin access enabled for ${result.rows[0].email}. Sign in again and open /admin.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await pool.end(); }
