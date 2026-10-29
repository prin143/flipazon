-- Flipazon Phase 3 (PostgreSQL). Idempotent schema creation for local development.
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(12) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('electronics','fashion','home','beauty','sports','accessories')),
  brand VARCHAR(80) NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  original_price INTEGER NOT NULL CHECK (original_price >= price),
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.5 CHECK (rating BETWEEN 0 AND 5),
  review_count INTEGER NOT NULL DEFAULT 0,
  image VARCHAR(120) NOT NULL DEFAULT '/products/headphones.svg',
  badge VARCHAR(30),
  badge_type VARCHAR(12),
  color VARCHAR(30) NOT NULL DEFAULT 'sky',
  description TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 20 CHECK (stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  PRIMARY KEY(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, product_id)
);

-- Phase 3: real order records for the local COD checkout flow.
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_number VARCHAR(48) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'placed'
    CHECK (status IN ('placed','confirmed','shipped','delivered','cancelled')),
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded')),
  subtotal INTEGER NOT NULL CHECK (subtotal > 0),
  shipping_fee INTEGER NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  total INTEGER NOT NULL CHECK (total > 0),
  customer_name VARCHAR(80) NOT NULL,
  customer_email VARCHAR(254) NOT NULL,
  phone VARCHAR(16) NOT NULL,
  address_line1 VARCHAR(180) NOT NULL,
  address_line2 VARCHAR(180) NOT NULL DEFAULT '',
  city VARCHAR(80) NOT NULL,
  state VARCHAR(80) NOT NULL,
  postal_code CHAR(6) NOT NULL,
  country VARCHAR(60) NOT NULL DEFAULT 'India',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(160) NOT NULL,
  brand VARCHAR(80) NOT NULL,
  image VARCHAR(120) NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  line_total INTEGER NOT NULL CHECK (line_total > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
