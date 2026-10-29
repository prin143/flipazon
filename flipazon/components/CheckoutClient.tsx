"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, MapPin, PackageCheck, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { currency, type Product } from "@/data/catalog";

type User = { id:number; name:string; email:string; role:"customer"|"admin" };
type CartItem = { id:number; quantity:number };
type StoreProduct = Product & { stock?:number };
type AddressForm = { fullName:string; phone:string; addressLine1:string; addressLine2:string; city:string; state:string; postalCode:string };
const blankAddress: AddressForm = { fullName:"",phone:"",addressLine1:"",addressLine2:"",city:"",state:"",postalCode:"" };

export default function CheckoutClient() {
  const router = useRouter();
  const [user,setUser] = useState<User|null>(null);
  const [cart,setCart] = useState<CartItem[]>([]);
  const [products,setProducts] = useState<StoreProduct[]>([]);
  const [address,setAddress] = useState<AddressForm>(blankAddress);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meResponse,productsResponse] = await Promise.all([
          fetch("/api/auth/me",{cache:"no-store"}),
          fetch("/api/products",{cache:"no-store"}),
        ]);
        const meData = meResponse.ok ? await meResponse.json() : {user:null};
        const productsData = productsResponse.ok ? await productsResponse.json() : {products:[]};
        if (cancelled) return;
        setUser(meData.user ?? null);
        setProducts(Array.isArray(productsData.products) ? productsData.products : []);
        if (meData.user) {
          setAddress((old) => ({...old,fullName:old.fullName || meData.user.name}));
          const cartResponse = await fetch("/api/cart",{cache:"no-store"});
          const cartData = cartResponse.ok ? await cartResponse.json() : {cart:[]};
          if (!cancelled) setCart(Array.isArray(cartData.cart) ? cartData.cart : []);
        }
      } catch {
        if (!cancelled) setError("Could not load checkout. Check that Flipazon and PostgreSQL are running.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => {cancelled=true;};
  },[]);

  const lines = useMemo(() => cart.map((item) => {
    const product = products.find((p) => p.id === item.id);
    return product ? { ...item,product,lineTotal:product.price * item.quantity } : null;
  }).filter((item): item is {id:number;quantity:number;product:StoreProduct;lineTotal:number} => item !== null),[cart,products]);
  const subtotal = lines.reduce((sum,line) => sum + line.lineTotal,0);
  const shippingFee = subtotal === 0 || subtotal >= 999 ? 0 : 49;
  const total = subtotal + shippingFee;

  function updateField(field:keyof AddressForm,value:string) {
    setAddress((old) => ({...old,[field]:value}));
    setError("");
  }

  async function placeOrder(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/checkout",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({...address,paymentMethod:"cod"}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not place order");
      router.push(`/orders?placed=${encodeURIComponent(data.order.orderNumber)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {setBusy(false);}
  }

  return <div className="commerce-page">
    <header className="commerce-header"><div className="container commerce-header-inner"><Link href="/" className="commerce-brand"><span>Flip</span><strong>azon</strong><i>.</i></Link><span className="commerce-secure"><LockKeyhole size={15}/> Secure checkout</span></div></header>
    <main className="container commerce-main">
      <Link href="/" className="commerce-back"><ArrowLeft size={16}/> Continue shopping</Link>
      <div className="commerce-heading"><span className="commerce-eyebrow"><PackageCheck size={15}/> ALMOST YOURS</span><h1>Checkout</h1><p>Confirm your delivery address and place your order.</p></div>
      {loading ? <div className="commerce-state">Loading your checkout…</div> : !user ? <section className="commerce-state commerce-state--center"><LockKeyhole size={34}/><h2>Sign in to continue</h2><p>Your account keeps your order history and delivery details together.</p><Link className="commerce-primary" href="/">Go to Flipazon and sign in <ArrowRight size={17}/></Link></section> : cart.length === 0 ? <section className="commerce-state commerce-state--center"><ShoppingBag size={36}/><h2>Your cart is empty</h2><p>Add products to your cart before checking out.</p><Link className="commerce-primary" href="/">Browse products <ArrowRight size={17}/></Link></section> : <form className="commerce-grid" onSubmit={(event)=>void placeOrder(event)}>
        <div className="commerce-main-column">
          <section className="commerce-card">
            <div className="commerce-card-title"><span className="commerce-step">1</span><div><h2>Delivery address</h2><p>Where should we deliver your order?</p></div><MapPin size={20}/></div>
            <div className="commerce-form-grid">
              <label>Full name<input autoComplete="name" required minLength={2} maxLength={80} value={address.fullName} onChange={(e)=>updateField("fullName",e.target.value)} placeholder="Name of the recipient"/></label>
              <label>Mobile number<input autoComplete="tel" required inputMode="tel" maxLength={16} pattern="(\+91[ -]?)?[6-9][0-9 ()-]{8,14}" value={address.phone} onChange={(e)=>updateField("phone",e.target.value)} placeholder="10-digit mobile number"/><small>Indian mobile number, including optional +91.</small></label>
              <label className="commerce-form-wide">Address line 1<input autoComplete="address-line1" required minLength={5} maxLength={180} value={address.addressLine1} onChange={(e)=>updateField("addressLine1",e.target.value)} placeholder="House / flat, street, area"/></label>
              <label className="commerce-form-wide">Address line 2 (optional)<input autoComplete="address-line2" maxLength={180} value={address.addressLine2} onChange={(e)=>updateField("addressLine2",e.target.value)} placeholder="Landmark, apartment, floor"/></label>
              <label>City<input autoComplete="address-level2" required maxLength={80} value={address.city} onChange={(e)=>updateField("city",e.target.value)} placeholder="City"/></label>
              <label>State<input autoComplete="address-level1" required maxLength={80} value={address.state} onChange={(e)=>updateField("state",e.target.value)} placeholder="State"/></label>
              <label>PIN code<input autoComplete="postal-code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={address.postalCode} onChange={(e)=>updateField("postalCode",e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit PIN code"/></label>
              <div className="commerce-country"><MapPin size={15}/> Country: India</div>
            </div>
          </section>
          <section className="commerce-card">
            <div className="commerce-card-title"><span className="commerce-step">2</span><div><h2>Payment method</h2><p>Online payments will be added in a later phase.</p></div><ShieldCheck size={20}/></div>
            <label className="payment-choice"><input type="radio" name="payment" checked readOnly/><span className="payment-choice-icon"><Truck size={21}/></span><span><strong>Cash on Delivery (COD)</strong><small>Pay when your order arrives. No online payment is collected in this version.</small></span><CheckCircle2 size={20} className="payment-selected"/></label>
          </section>
          {error && <div className="commerce-error" role="alert">{error}</div>}
          <button className="commerce-primary commerce-place-order" type="submit" disabled={busy || !lines.length}>{busy ? "Placing your order…" : `Place order · ${currency(total)}`} <ArrowRight size={18}/></button>
          <p className="commerce-legal"><ShieldCheck size={15}/> Demo development store. This checkout creates a real local database order using Cash on Delivery; it does not charge a payment method.</p>
        </div>
        <aside className="commerce-summary commerce-card"><div className="commerce-summary-title"><h2>Order summary</h2><span>{cart.reduce((sum,item)=>sum+item.quantity,0)} items</span></div>
          <div className="commerce-summary-lines">{lines.map((line)=><div className="commerce-summary-line" key={line.id}><img src={line.product.image} alt=""/><div className="commerce-summary-product"><strong>{line.product.name}</strong><small>Qty {line.quantity} · {line.product.brand}</small></div><b>{currency(line.lineTotal)}</b></div>)}</div>
          <div className="commerce-cost-row"><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
          <div className="commerce-cost-row"><span>Shipping</span><strong>{shippingFee===0 ? "FREE" : currency(shippingFee)}</strong></div>
          {subtotal>0 && subtotal<999 && <p className="commerce-shipping-note">Add {currency(999-subtotal)} more for free shipping.</p>}
          <div className="commerce-cost-total"><span>Total payable on delivery</span><strong>{currency(total)}</strong></div>
          <div className="commerce-summary-trust"><ShieldCheck size={17}/><span>Stock is checked again when you place the order.</span></div>
        </aside>
      </form>}
    </main>
  </div>;
}
