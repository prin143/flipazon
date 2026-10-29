"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Package, PackageCheck, ShoppingBag, Truck } from "lucide-react";
import { currency } from "@/data/catalog";

type OrderItem = { id:number|null; name:string; brand:string; image:string; unitPrice:number; quantity:number; lineTotal:number };
type Order = { id:number; orderNumber:string; status:string; paymentMethod:string; paymentStatus:string; subtotal:number; shippingFee:number; total:number; customerName:string; customerEmail:string; phone:string; addressLine1:string; addressLine2:string; city:string; state:string; postalCode:string; country:string; createdAt:string; items:OrderItem[] };
type User = { id:number; name:string; email:string; role:string };
const statusLabel:Record<string,string> = { placed:"Order placed",confirmed:"Confirmed",shipped:"Shipped",delivered:"Delivered",cancelled:"Cancelled" };

export default function OrdersClient() {
  const [orders,setOrders] = useState<Order[]>([]);
  const [user,setUser] = useState<User|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [placedNumber,setPlacedNumber] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const orderNumber = new URLSearchParams(window.location.search).get("placed") ?? "";
      if (!cancelled) setPlacedNumber(orderNumber);
      try {
        const [meResponse,ordersResponse] = await Promise.all([
          fetch("/api/auth/me",{cache:"no-store"}),fetch("/api/orders",{cache:"no-store"}),
        ]);
        const meData = meResponse.ok ? await meResponse.json() : {user:null};
        const ordersData = ordersResponse.ok ? await ordersResponse.json() : {orders:[]};
        if (cancelled) return;
        setUser(meData.user ?? null);
        if (!ordersResponse.ok && ordersResponse.status !== 401) setError(ordersData.error ?? "Could not load orders.");
        setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
      } catch { if (!cancelled) setError("Could not connect to Flipazon. Check the server and database."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => {cancelled=true;};
  },[]);

  return <div className="commerce-page">
    <header className="commerce-header"><div className="container commerce-header-inner"><Link href="/" className="commerce-brand"><span>Flip</span><strong>azon</strong><i>.</i></Link><span className="commerce-secure"><PackageCheck size={15}/> Your orders</span></div></header>
    <main className="container commerce-main commerce-orders-main">
      <Link href="/" className="commerce-back"><ArrowLeft size={16}/> Back to shopping</Link>
      {placedNumber && <section className="order-success"><span><CheckCircle2 size={28}/></span><div><h1>Order placed successfully!</h1><p>Your Flipazon order number is <strong>{placedNumber}</strong>. Choose Cash on Delivery when it arrives.</p></div></section>}
      <div className="commerce-heading"><span className="commerce-eyebrow"><Package size={15}/> YOUR FLIPAZON</span><h1>My orders</h1><p>See order details, delivery address and current order status.</p></div>
      {loading ? <div className="commerce-state">Loading your orders…</div> : !user ? <section className="commerce-state commerce-state--center"><Package size={36}/><h2>Sign in to view orders</h2><p>Your order history is connected to your Flipazon account.</p><Link className="commerce-primary" href="/">Go to Flipazon and sign in <ArrowRight size={17}/></Link></section> : error ? <div className="commerce-error">{error}</div> : orders.length===0 ? <section className="commerce-state commerce-state--center"><ShoppingBag size={36}/><h2>No orders yet</h2><p>Once you place an order, its details will appear here.</p><Link className="commerce-primary" href="/">Start shopping <ArrowRight size={17}/></Link></section> : <div className="orders-list">{orders.map((order)=><article className="order-card" key={order.id}>
        <div className="order-card-top"><div><span className="order-kicker">ORDER NUMBER</span><h2>{order.orderNumber}</h2><small>Placed {new Date(order.createdAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</small></div><span className={`order-status status-${order.status}`}><Clock3 size={14}/>{statusLabel[order.status] ?? order.status}</span></div>
        <div className="order-items">{order.items.map((item,index)=><div className="order-item" key={`${order.id}-${index}`}><img src={item.image} alt=""/><div><strong>{item.name}</strong><small>{item.brand} · Qty {item.quantity}</small></div><b>{currency(item.lineTotal)}</b></div>)}</div>
        <div className="order-card-bottom"><div className="order-delivery"><Truck size={17}/><span><strong>Delivering to {order.customerName}</strong><small>{order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city}, {order.state} — {order.postalCode}</small></span></div><div className="order-payment"><small>PAYMENT · {order.paymentMethod === "cod" ? "CASH ON DELIVERY" : order.paymentMethod}</small><strong>Total: {currency(order.total)}</strong><small>{order.paymentStatus === "pending" ? "Pay on delivery" : order.paymentStatus}</small></div></div>
      </article>)}</div>}
    </main>
  </div>;
}
