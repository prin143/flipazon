
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, ShoppingCart, Star } from "lucide-react";
import {
  products as sampleProducts,
  categories,
  currency,
  type Product,
} from "@/data/catalog";

type CartItem = { id: number; quantity: number };
type SortOrder = "featured" | "price-low" | "price-high" | "rating";

export default function SearchPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>(sampleProducts);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("featured");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q") ?? "";
    setQuery(initialQuery);
    setSearchInput(initialQuery);

    let cancelled = false;

    async function loadProducts() {
      try {
        const response = await fetch("/api/products", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = await response.json();

        if (!cancelled && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      } catch {
        // Use sample products if the API is unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  function doSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newQuery = searchInput.trim();
    setQuery(newQuery);
    setCategoryFilter("all");

    router.push(
      newQuery ? `/search?q=${encodeURIComponent(newQuery)}` : "/search"
    );
  }

  const visibleProducts = useMemo(() => {
    let result = products.filter((product) => {
      const searchableText =
        `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();

      const matchesQuery = searchableText.includes(query.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;

      return matchesQuery && matchesCategory;
    });

    if (sortOrder === "price-low") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortOrder === "price-high") {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (sortOrder === "rating") {
      result = [...result].sort((a, b) => b.rating - a.rating);
    }

    return result;
  }, [products, query, categoryFilter, sortOrder]);

  async function addToCart(product: Product) {
    try {
      const stock =
        "stock" in product && typeof product.stock === "number"
          ? product.stock
          : 99;

      const meResponse = await fetch("/api/auth/me", {
        cache: "no-store",
      });
      const meData = meResponse.ok ? await meResponse.json() : { user: null };

      if (meData.user) {
        const response = await fetch("/api/cart", { cache: "no-store" });

        if (!response.ok) throw new Error("Could not load your cart.");

        const data = await response.json();
        const current: CartItem[] = Array.isArray(data.cart) ? data.cart : [];
        const existing = current.find((item) => item.id === product.id);
        const quantity = existing?.quantity ?? 0;

        if (stock <= quantity) {
          setMessage("This product has reached its available stock.");
          return;
        }

        const nextCart = existing
          ? current.map((item) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          : [...current, { id: product.id, quantity: 1 }];

        const saveResponse = await fetch("/api/cart", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart: nextCart }),
        });

        if (!saveResponse.ok) throw new Error("Could not save your cart.");
      } else {
        let current: CartItem[] = [];

        try {
          const stored: unknown = JSON.parse(
            localStorage.getItem("flipazon-cart") ?? "[]"
          );

          if (Array.isArray(stored)) current = stored as CartItem[];
        } catch {
          current = [];
        }

        const existing = current.find((item) => item.id === product.id);
        const quantity = existing?.quantity ?? 0;

        if (stock <= quantity) {
          setMessage("This product has reached its available stock.");
          return;
        }

        const nextCart = existing
          ? current.map((item) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          : [...current, { id: product.id, quantity: 1 }];

        localStorage.setItem("flipazon-cart", JSON.stringify(nextCart));
      }

      setMessage(`${product.name} added to cart!`);
    } catch {
      setMessage("Could not update your cart. Please try again.");
    }
  }

  return (
    <main className="search-page">
      <style jsx>{`
        .search-page {
          min-height: 100vh;
          padding: 24px;
          background: #f7f8fc;
          color: #17233b;
        }
        .search-header {
          max-width: 1200px;
          margin: 0 auto 28px;
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
        }
        .back-btn {
          border: 1px solid #e1e5ed;
          background: white;
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .brand {
          font-size: 26px;
          font-weight: 800;
          color: #102344;
          white-space: nowrap;
        }
        .brand span { color: #ef9b13; }
        .search-form {
          flex: 1;
          min-width: 240px;
          display: flex;
          background: white;
          border: 1px solid #dce2ec;
          border-radius: 12px;
          overflow: hidden;
        }
        .search-form input {
          flex: 1;
          min-width: 0;
          padding: 14px;
          border: none;
          outline: none;
          font-size: 15px;
        }
        .search-form button {
          border: none;
          background: #ffcf2e;
          padding: 0 20px;
          cursor: pointer;
        }
        .results {
          max-width: 1200px;
          margin: 0 auto;
        }
        .heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }
        .heading h1 { margin: 0 0 8px; font-size: 28px; }
        .muted { color: #69758a; font-size: 14px; }
        .filters { display: flex; gap: 10px; flex-wrap: wrap; }
        .filters select {
          background: white;
          border: 1px solid #dce2ec;
          padding: 11px;
          border-radius: 9px;
          max-width: 100%;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
        }
        .card {
          background: white;
          border: 1px solid #e8ebf2;
          border-radius: 14px;
          overflow: hidden;
          padding: 14px;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .picture {
          height: 190px;
          background: #f6f7fb;
          border-radius: 10px;
          display: grid;
          place-items: center;
        }
        .picture img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 12px;
        }
        .brand-name {
          margin-top: 14px;
          color: #798397;
          font-size: 12px;
        }
        .product-name {
          font-weight: 650;
          margin: 6px 0 10px;
          line-height: 1.45;
        }
        .rating {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .rating svg { color: #efa916; }
        .price { font-size: 19px; font-weight: 800; }
        .original {
          color: #8790a0;
          text-decoration: line-through;
          font-size: 13px;
          margin-left: 8px;
        }
        .add-btn {
          margin-top: auto;
          padding: 11px;
          border: none;
          background: #ffcf2e;
          border-radius: 9px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }
        .empty {
          text-align: center;
          background: white;
          border-radius: 14px;
          padding: 55px 20px;
        }
        .empty h2 { margin-bottom: 8px; }
        .message {
          margin: 0 0 18px;
          padding: 12px 15px;
          background: #fff3c4;
          border-radius: 9px;
        }
        @media (max-width: 950px) {
          .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 650px) {
          .search-page { padding: 14px; }
          .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .picture { height: 145px; }
          .heading h1 { font-size: 23px; }
          .card { padding: 9px; }
          .price { font-size: 16px; }
          .original { display: block; margin: 5px 0; }
        }
        @media (max-width: 360px) {
          .grid { grid-template-columns: 1fr; }
          .picture { height: 200px; }
        }
      `}</style>

      <header className="search-header">
        <button className="back-btn" onClick={() => router.push("/")}>
          <ArrowLeft size={18} /> Home
        </button>

        <div className="brand">
          Flip<span>azon</span>
        </div>

        <form className="search-form" onSubmit={doSearch}>
          <input
            aria-label="Search products"
            placeholder="Search products, brands..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit" aria-label="Search">
            <Search size={21} />
          </button>
        </form>
      </header>

      <section className="results">
        <div className="heading">
          <div>
            <h1>
              {query ? `Results for "${query}"` : "Explore all products"}
            </h1>
            <p className="muted">
              {loading
                ? "Loading products..."
                : `${visibleProducts.length} products found`}
            </p>
          </div>

          <div className="filters">
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Sort products"
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as SortOrder)
              }
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to high</option>
              <option value="price-high">Price: High to low</option>
              <option value="rating">Top rated</option>
            </select>
          </div>
        </div>

        {message && (
          <p className="message" role="status">
            {message}
          </p>
        )}

        {!loading && visibleProducts.length === 0 ? (
          <div className="empty">
            <Search size={38} />
            <h2>No products found</h2>
            <p>Try another keyword or select a different category.</p>
            <button
              className="back-btn"
              onClick={() => {
                setQuery("");
                setSearchInput("");
                setCategoryFilter("all");
                router.push("/search");
              }}
            >
              Browse all products
            </button>
          </div>
        ) : (
          <div className="grid">
            {visibleProducts.map((product) => (
              <article className="card" key={product.id}>
                <div className="picture">
                  <img src={product.image} alt={product.name} loading="lazy" />
                </div>

                <div className="brand-name">{product.brand}</div>
                <div className="product-name">{product.name}</div>

                <div className="rating">
                  <Star size={15} fill="currentColor" />
                  <strong>{product.rating.toFixed(1)}</strong>
                  <span className="muted">
                    ({product.reviewCount.toLocaleString("en-IN")})
                  </span>
                </div>

                <div>
                  <span className="price">{currency(product.price)}</span>
                  <span className="original">
                    {currency(product.originalPrice)}
                  </span>
                </div>

                <button
                  className="add-btn"
                  onClick={() => void addToCart(product)}
                >
                  <ShoppingCart size={17} /> Add to cart
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
