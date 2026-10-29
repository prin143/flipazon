"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, BadgePercent, Bell, Check,
  ChevronDown, ChevronLeft, ChevronRight, CreditCard, Heart, Headphones,
  HelpCircle, MapPin, Menu, Minus, Package, Plus, Search, ShieldCheck,
  ShoppingBag, ShoppingCart, SlidersHorizontal, Sparkles, Star, Store,
  Tag, Trash2, Truck, UserRound, X,
} from "lucide-react";
import { categories, currency, products as sampleProducts, type CategoryId, type Product } from "@/data/catalog";
import AccountModal, { type SignedInUser } from "@/components/AccountModal";

type CartItem = { id: number; quantity: number };
type SortOrder = "featured" | "price-low" | "price-high" | "rating";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`} aria-label="Flipazon">
      <span className="brand-icon" aria-hidden="true">
        <svg viewBox="0 0 54 54" width="39" height="39" role="img">
          <rect width="54" height="54" rx="14" fill="#ffcf2e" />
          <path d="M16 14h27l-4.2 9H25l-3 7h13l-4 9H18l-4 7H5l16-32z" fill="#091d40" />
          <path d="m39 12-6 14 11-3-5 13 11-18-10 3 4-9z" fill="#fff" />
        </svg>
      </span>
      {!compact && <span className="brand-name"><span>Flip</span><strong>azon</strong><i className="brand-dot">.</i></span>}
    </div>
  );
}

function ProductCard({ product, isSaved, onSave, onAdd, onView }: {
  product: Product; isSaved: boolean; onSave: () => void; onAdd: () => void; onView: () => void;
}) {
  const discount = Math.round((1 - product.price / product.originalPrice) * 100);
  return (
    <article className="product-card">
      <div className={`product-picture tone-${product.color}`}>
        <button className="image-click" aria-label={`View ${product.name}`} onClick={onView}>
          {/* Locally authored product illustrations: no external image service required. */}
          <img src={product.image} alt={product.name} loading="lazy" />
        </button>
        {product.badge && <span className={`product-badge badge-${product.badgeType ?? "sale"}`}>{product.badge}</span>}
        <button className={`favorite-icon ${isSaved ? "is-saved" : ""}`} aria-label={isSaved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`} onClick={onSave} title="Save to wishlist">
          <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-info">
        <div className="product-brand">{product.brand}</div>
        <button className="product-title" onClick={onView}>{product.name}</button>
        <div className="rating-line"><Star size={14} fill="currentColor" strokeWidth={0} /><b>{product.rating.toFixed(1)}</b><span>({product.reviewCount.toLocaleString("en-IN")})</span><span className="rating-separator" /> <span className="free-delivery">Free delivery</span></div>
        <div className="price-line"><strong>{currency(product.price)}</strong><del>{currency(product.originalPrice)}</del><span>{discount}% off</span></div>
        <button className="add-btn" onClick={onAdd}><Plus size={17} strokeWidth={2.5} /> Add to cart</button>
      </div>
    </article>
  );
}

export default function Storefront() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(sampleProducts);
  const [profile, setProfile] = useState<SignedInUser | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("featured");
  const [toast, setToast] = useState("");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const productSection = useRef<HTMLElement | null>(null);
  const categorySection = useRef<HTMLElement | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Guest state remains local. Signed-in state is read from PostgreSQL.
    let guestCart: CartItem[] = [];
    let guestWishlist: number[] = [];
    try {
      const cartData: unknown = JSON.parse(localStorage.getItem("flipazon-cart") ?? "[]");
      const saveData: unknown = JSON.parse(localStorage.getItem("flipazon-wishlist") ?? "[]");
      if (Array.isArray(cartData)) guestCart = cartData.filter((item): item is CartItem => typeof item?.id === "number" && Number.isSafeInteger(item.id) && item.id > 0 && Number.isInteger(item?.quantity) && item.quantity > 0 && item.quantity <= 99);
      if (Array.isArray(saveData)) guestWishlist = saveData.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0);
    } catch { /* Ignore invalid browser storage. */ }
    async function initialize() {
      let remoteUser: SignedInUser | null = null;
      try {
        const [productResponse, meResponse] = await Promise.all([
          fetch("/api/products", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ]);
        if (productResponse.ok) {
          const data = await productResponse.json();
          if (Array.isArray(data.products)) {
            setProducts(data.products);
            guestCart = guestCart.filter((item) => data.products.some((p: Product) => p.id === item.id));
            guestWishlist = guestWishlist.filter((id) => data.products.some((p: Product) => p.id === id));
          }
        }
        if (meResponse.ok) remoteUser = (await meResponse.json()).user ?? null;
      } catch { /* Catalog demo stays usable without the database. */ }
      if (remoteUser) {
        try {
          const [cartResponse, wishlistResponse] = await Promise.all([
            fetch("/api/cart", { cache: "no-store" }),
            fetch("/api/wishlist", { cache: "no-store" }),
          ]);
          if (cartResponse.ok && wishlistResponse.ok) {
            setCart((await cartResponse.json()).cart);
            setSaved((await wishlistResponse.json()).wishlist);
            setProfile(remoteUser);
          } else { setCart(guestCart); setSaved(guestWishlist); }
        } catch { setCart(guestCart); setSaved(guestWishlist); }
      } else { setCart(guestCart); setSaved(guestWishlist); }
      setHydrated(true);
    }
    void initialize();
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      if (profile) {
        void fetch("/api/cart", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart }) })
          .then(async (response) => { if (!response.ok) { const body = await response.json(); announce(body.error ?? "Could not sync cart"); } })
          .catch(() => announce("Cart sync failed. Check your connection."));
      } else localStorage.setItem("flipazon-cart", JSON.stringify(cart));
    }, 350);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, hydrated, profile]);
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      if (profile) {
        void fetch("/api/wishlist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wishlist: saved }) })
          .then(async (response) => { if (!response.ok) { const body = await response.json(); announce(body.error ?? "Could not sync wishlist"); } })
          .catch(() => announce("Wishlist sync failed. Check your connection."));
      } else localStorage.setItem("flipazon-wishlist", JSON.stringify(saved));
    }, 350);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, hydrated, profile]);

  async function onAuthenticated(user: SignedInUser) {
    setHydrated(false);
    try {
      const [cartResponse, wishlistResponse] = await Promise.all([
        fetch("/api/cart", { cache: "no-store" }),
        fetch("/api/wishlist", { cache: "no-store" }),
      ]);
      if (!cartResponse.ok || !wishlistResponse.ok) throw new Error("Could not load saved shopping data.");
      const remoteCart = ((await cartResponse.json()).cart ?? []) as CartItem[];
      const remoteWishlist = ((await wishlistResponse.json()).wishlist ?? []) as number[];
      let guestCart: CartItem[] = [...cart];
      let guestWishlist: number[] = [...saved];
      try {
        const parsedCart: unknown = JSON.parse(localStorage.getItem("flipazon-cart") ?? "[]");
        const parsedWishlist: unknown = JSON.parse(localStorage.getItem("flipazon-wishlist") ?? "[]");
        if (!guestCart.length && Array.isArray(parsedCart)) guestCart = parsedCart.filter((item): item is CartItem => typeof item?.id === "number" && Number.isInteger(item?.quantity) && item.quantity > 0);
        if (!guestWishlist.length && Array.isArray(parsedWishlist)) guestWishlist = parsedWishlist.filter((id): id is number => typeof id === "number");
      } catch { /* Ignore invalid guest storage. */ }
      const merged = new Map<number, number>();
      for (const item of remoteCart) {
        const product = products.find((p) => p.id === item.id);
        if (!product) continue;
        const stock = "stock" in product && typeof product.stock === "number" ? product.stock : 99;
        const quantity = Math.min(item.quantity, stock, 99);
        if (quantity > 0) merged.set(item.id, quantity);
      }
      for (const item of guestCart) {
        const product = products.find((p) => p.id === item.id);
        if (!product) continue;
        const stock = "stock" in product && typeof product.stock === "number" ? product.stock : 99;
        merged.set(item.id, Math.min(stock, 99, (merged.get(item.id) ?? 0) + item.quantity));
      }
      const mergedCart = [...merged.entries()].filter(([,quantity]) => quantity > 0).map(([id,quantity]) => ({id,quantity}));
      const mergedWishlist = [...new Set([...remoteWishlist,...guestWishlist])].filter((id) => products.some((p) => p.id === id));
      const [saveCart,saveWishlist] = await Promise.all([
        fetch("/api/cart", { method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({cart:mergedCart}) }),
        fetch("/api/wishlist", { method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({wishlist:mergedWishlist}) }),
      ]);
      if (!saveCart.ok || !saveWishlist.ok) throw new Error("Signed in, but shopping data could not be merged. Refresh and retry.");
      setCart(mergedCart);
      setSaved(mergedWishlist);
      setProfile(user);
      localStorage.removeItem("flipazon-cart");
      localStorage.removeItem("flipazon-wishlist");
      setHydrated(true);
      announce(`Welcome to Flipazon, ${user.name}!`);
      if (pendingCheckout) { setPendingCheckout(false); router.push("/checkout"); }
    } catch (error) { setHydrated(true); throw error; }
  }

  async function startCheckout() {
    setCartOpen(false);
    if (!profile) {
      setPendingCheckout(true);
      setAccountOpen(true);
      announce("Please sign in or create an account to place your order.");
      return;
    }
    try {
      const response = await fetch("/api/cart", { method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({cart}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not sync your cart");
      router.push("/checkout");
    } catch (error) { announce(error instanceof Error ? error.message : "Could not start checkout"); }
  }

  function openOrders() {
    if (!profile) { setAccountOpen(true); announce("Sign in to view your orders."); return; }
    router.push("/orders");
  }
  async function onLogout() {
    setHydrated(false);
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) { setHydrated(true); throw new Error("Could not sign out. Please retry."); }
    localStorage.removeItem("flipazon-cart");
    localStorage.removeItem("flipazon-wishlist");
    setProfile(null);
    setCart([]);
    setSaved([]);
    setHydrated(true);
    announce("Signed out successfully.");
  }
  useEffect(() => {
    const lock = cartOpen || accountOpen || selectedProduct !== null || mobileNavOpen;
    document.body.style.overflow = lock ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [cartOpen, accountOpen, selectedProduct, mobileNavOpen]);
  useEffect(() => () => { if (toastTimeout.current) clearTimeout(toastTimeout.current); }, []);

  function announce(message: string) {
    setToast(message);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(""), 3100);
  }
  function jumpToProducts() { productSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function jumpToCategories() { categorySection.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function chooseCategory(category: CategoryId) {
    setActiveCategory(category); setWishlistOnly(false); setMobileNavOpen(false); setSearchQuery(""); setSearchValue("");
    setTimeout(jumpToProducts, 30);
  }
  function doSearch() {
    setSearchQuery(searchValue.trim()); setActiveCategory("all"); setWishlistOnly(false); setMobileNavOpen(false);
    setTimeout(jumpToProducts, 30);
  }
  function showWishlist() { setWishlistOnly(true); setActiveCategory("all"); setSearchQuery(""); setSearchValue(""); setMobileNavOpen(false); setTimeout(jumpToProducts, 30); }
  function addToCart(id: number) {
    const product = products.find((p) => p.id === id);
    if (!product || ("stock" in product && typeof product.stock === "number" && (cart.find(i => i.id === id)?.quantity ?? 0) >= product.stock)) { announce("Product is currently out of stock."); return; }
    setCart((old) => {
      const match = old.find((item) => item.id === id);
      return match ? old.map((item) => item.id === id ? { ...item, quantity: Math.min(item.quantity + 1, 99) } : item) : [...old, { id, quantity: 1 }];
    });
    announce("Added to your cart!");
  }
  function updateQuantity(id: number, diff: number) {
    const product = products.find((p) => p.id === id);
    if (diff > 0 && product && "stock" in product && typeof product.stock === "number" && (cart.find(i => i.id === id)?.quantity ?? 0) >= product.stock) {
      announce("Only available stock can be added.");
      return;
    }
    setCart((old) => old.map((item) => item.id === id ? { ...item, quantity: item.quantity + diff } : item).filter((item) => item.quantity > 0 && item.quantity <= 99));
  }
  function toggleSave(id: number) {
    const already = saved.includes(id);
    setSaved((old) => already ? old.filter((x) => x !== id) : [...old, id]);
    announce(already ? "Removed from wishlist" : "Saved to your wishlist!");
  }
  function resetFilters() { setActiveCategory("all"); setWishlistOnly(false); setSearchQuery(""); setSearchValue(""); setSortOrder("featured"); }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + (products.find((p) => p.id === item.id)?.price ?? 0) * item.quantity, 0);
  const cartSavings = cart.reduce((sum, item) => sum + ((products.find((p) => p.id === item.id)?.originalPrice ?? 0) - (products.find((p) => p.id === item.id)?.price ?? 0)) * item.quantity, 0);
  const visibleProducts = useMemo(() => {
    let result = products.filter((product) => {
      if (wishlistOnly && !saved.includes(product.id)) return false;
      if (activeCategory !== "all" && product.category !== activeCategory) return false;
      if (searchQuery && !`${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
    if (sortOrder === "price-low") result = [...result].sort((a, b) => a.price - b.price);
    if (sortOrder === "price-high") result = [...result].sort((a, b) => b.price - a.price);
    if (sortOrder === "rating") result = [...result].sort((a, b) => b.rating - a.rating);
    return result;
  }, [activeCategory, products, saved, searchQuery, sortOrder, wishlistOnly]);

  const currentTitle = wishlistOnly ? "Your wishlist" : searchQuery ? `Results for “${searchQuery}”` : activeCategory !== "all" ? `${categories.find((c) => c.id === activeCategory)?.name} picks` : "Trending right now";

  return (
    <div className="site-shell">
      <div className="top-announcement"><div className="container announcement-inner"><span><Sparkles size={13} /> Big savings, little surprises. Discover deals picked for you.</span><span className="announcement-right">Shop more. Save more. <ArrowRight size={14} /></span></div></div>
      <header className="main-header">
        <div className="container header-inner">
          <button className="mobile-menu plain-icon" aria-label="Open menu" onClick={() => setMobileNavOpen(true)}><Menu size={24} /></button>
          <button className="brand-button" aria-label="Flipazon home" onClick={() => { resetFilters(); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Brand /></button>
          <div className="delivery-pill"><MapPin size={18} /><span><small>Delivering across</small><strong>India <ChevronDown size={12} /></strong></span></div>
          <form className="search-box" onSubmit={(event) => { event.preventDefault(); doSearch(); }} role="search">
            <span className="search-all">All <ChevronDown size={13} /></span>
            <input aria-label="Search products" type="search" placeholder="Search for products, brands and more..." value={searchValue} onChange={(event) => setSearchValue(event.target.value)} />
            <button type="submit" aria-label="Search"><Search size={21} strokeWidth={2.5} /></button>
          </form>
          <button className="header-action header-account" onClick={() => setAccountOpen(true)}><UserRound size={21} /><span><small>{profile ? `Hello, ${profile.name.split(" ")[0]}` : "Hello, welcome"}</small><strong>{profile ? "My Profile" : "My Account"} <ChevronDown size={13} /></strong></span></button>
          <button className="header-action header-wishlist" aria-label={`Wishlist with ${saved.length} items`} onClick={showWishlist}><span className="header-action-icon"><Heart size={23} />{saved.length > 0 && <b>{saved.length}</b>}</span><span className="header-action-label">Wishlist</span></button>
          <button className="header-action header-cart" aria-label={`Cart with ${cartCount} items`} onClick={() => setCartOpen(true)}><span className="header-action-icon"><ShoppingCart size={25} />{cartCount > 0 && <b>{cartCount}</b>}</span><span className="header-action-label">Cart</span></button>
        </div>
      </header>
      <nav className="category-nav" aria-label="Main navigation"><div className="container nav-inner">
        <button className="nav-all" onClick={jumpToCategories}><Menu size={17} /> All categories</button>
        <span className="nav-divider" />
        <button onClick={() => chooseCategory("electronics")}>Electronics</button><button onClick={() => chooseCategory("fashion")}>Fashion</button><button onClick={() => chooseCategory("home")}>Home & Living</button><button onClick={() => chooseCategory("beauty")}>Beauty</button><button onClick={() => chooseCategory("sports")}>Sports</button><button onClick={() => chooseCategory("accessories")}>Accessories</button>
        <button className="nav-deals" onClick={() => { resetFilters(); setTimeout(jumpToProducts, 30); }}><BadgePercent size={17} /> Today’s Deals</button>
      </div></nav>

      <main>
        <section className="hero-wrap container" aria-label="Featured promotion">
          <div className="hero-main">
            <div className="hero-glow hero-glow-one"/><div className="hero-glow hero-glow-two"/>
            <div className="hero-copy"><span className="hero-eyebrow"><Sparkles size={14}/> THE EVERYDAY WOW SALE</span>
              <h1>More to love.<br /><em>Less to spend.</em></h1>
              <p>Big finds, better prices, and a little happiness in every cart. Your next favorite thing is right here.</p>
              <div className="hero-cta"><button className="btn-yellow" onClick={() => { resetFilters(); setTimeout(jumpToProducts, 30); }}>Shop the deals <ArrowRight size={18}/></button><button className="hero-secondary" onClick={jumpToCategories}>Explore categories <ArrowDownRight size={18}/></button></div>
              <div className="hero-notes"><span><Check size={15}/> New finds daily</span><span><Check size={15}/> Great prices</span></div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-circle"/>
              <div className="hero-visual hero-visual-headphones"><img src="/products/headphones.svg" alt=""/></div>
              <div className="hero-visual hero-visual-watch"><img src="/products/watch.svg" alt=""/></div>
              <div className="hero-discount"><span>UP TO</span><strong>50%</strong><small>OFF*</small></div>
              <div className="hero-stars hero-star-one">✦</div><div className="hero-stars hero-star-two">✦</div>
              <div className="hero-orbit"/>
            </div>
          </div>
          <div className="hero-side">
            <div className="mini-promo mini-promo-peach"><div><span className="mini-label">JUST DROPPED</span><h3>Step into<br />your style.</h3><button onClick={() => chooseCategory("fashion")}>Shop fashion <ArrowRight size={15}/></button></div><img src="/products/sneakers.png" alt="Stylish sneakers" /></div>
            <div className="mini-promo mini-promo-mint"><div><span className="mini-label">FRESH PICKS</span><h3>Little things.<br />Big upgrades.</h3><button onClick={() => chooseCategory("home")}>Explore home <ArrowRight size={15}/></button></div><img src="/products/lamp.png" alt="Modern desk lamp" /></div>
          </div>
        </section>

        <section className="trust-wrap container" aria-label="Shopping benefits">
          <div className="trust-item"><span className="trust-icon"><Truck size={23}/></span><span><strong>Fast & easy delivery</strong><small>Convenient doorstep shipping</small></span></div>
          <div className="trust-item"><span className="trust-icon"><ShieldCheck size={23}/></span><span><strong>Secure shopping</strong><small>Designed with your safety in mind</small></span></div>
          <div className="trust-item"><span className="trust-icon"><Tag size={23}/></span><span><strong>Prices you'll love</strong><small>Fresh deals every day</small></span></div>
          <div className="trust-item"><span className="trust-icon"><Headphones size={23}/></span><span><strong>Here to help</strong><small>Support experience coming soon</small></span></div>
        </section>

        <section className="container category-section" id="categories" ref={categorySection}>
          <div className="section-heading"><div><span className="eyebrow">DISCOVER YOUR NEXT FAVORITE</span><h2>Shop by category<span className="heading-spark">✳</span></h2><p>Whatever's on your list, there's something here for you.</p></div><button className="text-link" onClick={() => chooseCategory("all")}>View all products <ArrowRight size={17}/></button></div>
          <div className="category-grid">{categories.map((category) => (
            <button className={`category-tile tone-${category.theme}`} key={category.id} onClick={() => chooseCategory(category.id)}>
              <div className="category-art"><img src={category.image} alt="" loading="lazy" /></div>
              <div className="category-tile-bottom"><span><strong>{category.name}</strong><small>{category.subtitle}</small></span><span className="category-round"><ArrowRight size={18}/></span></div>
            </button>
          ))}</div>
        </section>

        <section className="container products-section" id="products" ref={productSection}>
          <div className="section-heading product-heading"><div><span className="eyebrow"><span className="red-dot"/> CURATED FOR YOU</span><h2>{currentTitle}</h2><p>{wishlistOnly ? `${visibleProducts.length} saved item${visibleProducts.length === 1 ? "" : "s"}. Your picks, all in one place.` : searchQuery ? `${visibleProducts.length} product${visibleProducts.length === 1 ? "" : "s"} found.` : "Discover great picks at prices worth smiling about."}</p></div>
          <div className="product-controls"><button className="filter-chip" onClick={() => { resetFilters(); announce("Showing all products"); }}><SlidersHorizontal size={17}/> {activeCategory !== "all" || wishlistOnly || searchQuery ? "Clear filters" : "All products"}</button><label className="sort-select"><span>Sort:</span><select aria-label="Sort products" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}><option value="featured">Featured</option><option value="price-low">Price: Low to high</option><option value="price-high">Price: High to low</option><option value="rating">Top rated</option></select><ChevronDown size={15}/></label></div>
          </div>
          {visibleProducts.length ? <div className="products-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} isSaved={saved.includes(product.id)} onSave={() => toggleSave(product.id)} onAdd={() => addToCart(product.id)} onView={() => setSelectedProduct(product)} />)}</div> : <div className="empty-products"><Search size={36}/><h3>No products found</h3><p>Try a different search or browse the full collection.</p><button className="btn-yellow" onClick={resetFilters}>See all products <ArrowRight size={17}/></button></div>}
          <div className="product-bottom"><span>Showing {visibleProducts.length} of {products.length} curated products</span>{(activeCategory !== "all" || wishlistOnly || searchQuery) && <button className="outline-button" onClick={resetFilters}>Browse all products <ArrowRight size={17}/></button>}</div>
        </section>

        <section className="container editorial-section" aria-label="Featured collections">
          <div className="editorial-card editorial-dark"><div className="editorial-copy"><span className="editorial-kicker"><Sparkles size={15}/> SMART SHOPPING STARTS HERE</span><h2>Tech that gets<br /><em>you excited.</em></h2><p>Upgrade your everyday with feel-good gadgets and exciting essentials.</p><button onClick={() => chooseCategory("electronics")}>Explore electronics <ArrowRight size={18}/></button></div><img src="/products/tablet.svg" alt="Tablet device" /></div>
          <div className="editorial-card editorial-light"><div className="editorial-copy"><span className="editorial-kicker">MADE FOR YOUR MOMENTS</span><h2>Everyday essentials.<br />Extraordinary style.</h2><p>Thoughtful picks that look as good as they feel.</p><button onClick={() => chooseCategory("accessories")}>Discover accessories <ArrowRight size={18}/></button></div><img src="/products/watch.svg" alt="Smartwatch" /></div>
        </section>

        <section className="container newsletter-section"><div className="newsletter-left"><span className="newsletter-icon"><Bell size={29}/></span><span><h2>Good deals. Great inbox.</h2><p>Be the first to know when new offers land.</p></span></div><form onSubmit={(event) => { event.preventDefault(); if (email.trim()) { setSubscribed(true); announce("Demo only: no email was sent or stored."); } }}><input aria-label="Email address" type="email" placeholder="Enter your email address" value={email} onChange={(event) => { setEmail(event.target.value); setSubscribed(false); }} required /><button type="submit">{subscribed ? "Preview saved" : "Get updates"} <ArrowRight size={17}/></button><small>Demo form only — no subscription service connected.</small></form></section>
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div className="footer-about"><Brand/><p>Your happy place for everyday finds. Discover more, spend less, and enjoy the little things.</p><div className="footer-chip"><ShoppingBag size={15}/> Built for smarter shopping</div></div><div><h3>Explore</h3><button onClick={() => chooseCategory("electronics")}>Electronics</button><button onClick={() => chooseCategory("fashion")}>Fashion</button><button onClick={() => chooseCategory("home")}>Home & Living</button><button onClick={() => chooseCategory("beauty")}>Beauty</button></div><div><h3>Your Flipazon</h3><button onClick={() => setAccountOpen(true)}>My account</button><button onClick={showWishlist}>Wishlist</button><button onClick={() => setCartOpen(true)}>Shopping cart</button><button onClick={openOrders}>My orders</button></div><div><h3>Help & info</h3><button onClick={() => announce("Customer support is planned for a later version.")}>Help center (soon)</button><button onClick={() => announce("Shipping policy will be added before launch.")}>Shipping info (soon)</button><button onClick={() => announce("Return policy will be added before launch.")}>Returns (soon)</button><button onClick={() => announce("Seller onboarding is planned for a later phase.")}>Become a seller (soon)</button></div></div><div className="container footer-bottom"><p>© {new Date().getFullYear()} Flipazon. Development storefront. Product names, ratings, prices and offers are illustrative; COD orders are stored locally in PostgreSQL.</p><p>Made with <Heart size={13} fill="currentColor"/> for everyday discoveries.</p></div></footer>

      <div className="mobile-bottom-bar" aria-label="Mobile shortcuts"><button onClick={() => { resetFilters(); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Store size={20}/><span>Home</span></button><button onClick={jumpToCategories}><Menu size={20}/><span>Categories</span></button><button onClick={showWishlist}><Heart size={20}/><span>Wishlist</span></button><button onClick={() => setCartOpen(true)}><span className="mobile-cart-count"><ShoppingCart size={21}/>{cartCount > 0 && <b>{cartCount}</b>}</span><span>Cart</span></button></div>

      {mobileNavOpen && <div className="overlay" onMouseDown={() => setMobileNavOpen(false)}><aside className="drawer drawer-left" onMouseDown={(event) => event.stopPropagation()} aria-label="Mobile menu"><div className="drawer-top"><Brand/><button aria-label="Close menu" className="plain-icon" onClick={() => setMobileNavOpen(false)}><X size={23}/></button></div><div className="mobile-nav-items"><button onClick={() => chooseCategory("all")}>All products <ArrowRight size={17}/></button>{categories.map((category) => <button key={category.id} onClick={() => chooseCategory(category.id)}>{category.name}<ArrowRight size={17}/></button>)}<button onClick={showWishlist}>Saved items <Heart size={17}/></button></div></aside></div>}

      {cartOpen && <div className="overlay" onMouseDown={() => setCartOpen(false)}><aside className="drawer cart-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label="Shopping cart"><div className="drawer-top"><div><span className="drawer-eyebrow">YOUR BAG</span><h2>Shopping cart <span className="cart-number">{cartCount}</span></h2></div><button aria-label="Close cart" className="plain-icon" onClick={() => setCartOpen(false)}><X size={23}/></button></div>{cart.length ? <><div className="cart-lines">{cart.map((item) => { const product = products.find((p) => p.id === item.id); if (!product) return null; return <div className="cart-line" key={item.id}><img src={product.image} alt={product.name} className={`tone-${product.color}`}/><div><strong>{product.name}</strong><span>{currency(product.price)}</span><div className="qty-control"><button aria-label={`Remove one ${product.name}`} onClick={() => updateQuantity(item.id, -1)}><Minus size={14}/></button><b>{item.quantity}</b><button aria-label={`Add one ${product.name}`} disabled={item.quantity >= 99} onClick={() => updateQuantity(item.id, 1)}><Plus size={14}/></button></div></div><button className="remove-cart" aria-label={`Remove ${product.name} from cart`} onClick={() => setCart((old) => old.filter((x) => x.id !== item.id))}><Trash2 size={17}/></button></div>; })}</div><div className="cart-checkout"><div className="cart-saving"><Tag size={17}/> You saved {currency(cartSavings)} on demo prices!</div><div className="subtotal"><span>Subtotal ({cartCount} items)</span><strong>{currency(cartTotal)}</strong></div><p>Cash on Delivery is available in this development version. Online payments are not connected.</p><button className="btn-yellow checkout-button" onClick={() => void startCheckout()}>Proceed to checkout <ArrowRight size={18}/></button><button className="continue-shopping" onClick={() => setCartOpen(false)}>Continue shopping</button></div></> : <div className="cart-empty"><div><ShoppingBag size={50}/></div><h3>Your cart feels a little empty</h3><p>There are so many good things waiting to be discovered.</p><button className="btn-yellow" onClick={() => { setCartOpen(false); jumpToProducts(); }}>Shop now <ArrowRight size={17}/></button></div>}</aside></div>}

      {accountOpen && <AccountModal user={profile} close={() => setAccountOpen(false)} onAuthenticated={onAuthenticated} onLogout={onLogout} />}

      {selectedProduct && <div className="overlay modal-overlay" onMouseDown={() => setSelectedProduct(null)}><div className="detail-modal" role="dialog" aria-modal="true" aria-label={selectedProduct.name} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close product details" onClick={() => setSelectedProduct(null)}><X size={21}/></button><div className={`detail-image tone-${selectedProduct.color}`}><img src={selectedProduct.image} alt={selectedProduct.name}/></div><div className="detail-copy"><span className="product-brand">{selectedProduct.brand}</span><h2>{selectedProduct.name}</h2><div className="rating-line"><Star size={16} fill="currentColor" strokeWidth={0}/><b>{selectedProduct.rating.toFixed(1)}</b><span>({selectedProduct.reviewCount.toLocaleString("en-IN")} demo reviews)</span></div><p>{selectedProduct.description}</p><div className="detail-price"><strong>{currency(selectedProduct.price)}</strong><del>{currency(selectedProduct.originalPrice)}</del><span>{Math.round((1 - selectedProduct.price / selectedProduct.originalPrice) * 100)}% off</span></div><div className="detail-actions"><button className="btn-yellow" onClick={() => addToCart(selectedProduct.id)}><ShoppingCart size={18}/> Add to cart</button><button className="detail-heart" aria-label="Save to wishlist" onClick={() => toggleSave(selectedProduct.id)}><Heart size={20} fill={saved.includes(selectedProduct.id) ? "currentColor" : "none"}/></button></div><span className="detail-disclaimer"><Package size={17}/> Development catalog. Cash on Delivery orders are enabled.</span></div></div></div>}

      {toast && <div role="status" className="toast"><Check size={19}/>{toast}</div>}
    </div>
  );
}
