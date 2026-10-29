"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, RefreshCw, ShieldCheck, Truck, PackageCheck, AlertTriangle } from "lucide-react";
import { currency } from "@/data/catalog";

type AdminItem = { name:string; brand:string; image:string; unitPrice:number; quantity:number; lineTotal:number };
type AdminOrder = { id:number; orderNumber:string; status:string; paymentMethod:string; paymentStatus:string; subtotal:number; shippingFee:number; total:number; customerName:string; customerEmail:string; phone:string; addressLine1:string; addressLine2:string; city:string; state:string; postalCode:string; createdAt:string; items:AdminItem[] };
type User = { name:string; email:string; role:string };
const statusLabel:Record<string,string> = { placed:"Order placed",confirmed:"Confirmed",shipped:"Shipped",delivered:"Delivered",cancelled:"Cancelled" };
const nextStatuses:Record<string,string[]> = { placed:["confirmed","cancelled"],confirmed:["shipped","cancelled"],shipped:["delivered"],delivered:[],cancelled:[] };

export default function AdminOrders() {
  const [user,setUser] = useState<User|null>(null);
  const [orders,setOrders] = useState<AdminOrder[]>([]);
  const [loading,setLoading] = useState(true);
  const [busyId,setBusyId] = useState<number|null>(null);
  const [message,setMessage] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [meResponse,ordersResponse] = await Promise.all([fetch("/api/auth/me",{cache:"no-store"}),fetch("/api/admin/orders",{cache:"no-store"})]);
      const meData = meResponse.ok ? await meResponse.json() : {user:null};
      const ordersData = ordersResponse.ok ? await ordersResponse.json() : {orders:[],error:"Admin access required. Sign in with an admin account."};
      setUser(meData.user ?? null);
      if (!ordersResponse.ok) {setMessage(ordersData.error ?? "Could not load orders");return;}
      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);setMessage("");
    } catch {setMessage("Backend unavailable. Check PostgreSQL and Next.js.");}
    finally {setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  async function changeStatus(order:AdminOrder,status:string) {
    if (status === "cancelled" && !window.confirm(`Cancel ${order.orderNumber}? Product stock will be restored.`)) return;
    setBusyId(order.id);setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update order");
      await refresh();setMessage(`${order.orderNumber} updated to ${statusLabel[status] ?? status}.`);
    } catch(error) {setMessage(error instanceof Error ? error.message : "Request failed");}
    finally {setBusyId(null);}
  }
  return <div className="admin-page">
    <header className="admin-header"><div className="container admin-header-inner"><Link href="/admin" className="admin-back"><ArrowLeft size={19}/> Dashboard</Link><span className="admin-logo">Flip<span>azon</span><b> ORDERS</b></span><button onClick={()=>void refresh()} className="admin-refresh"><RefreshCw size={17}/> Refresh</button></div></header>
    <main className="container admin-main"><div className="admin-hero"><span className="admin-eyebrow"><ShieldCheck size={15}/> PRIVATE ADMIN AREA</span><h1><ClipboardList size={32}/> Order management</h1><p>Review customer orders and update fulfilment status. COD payments are not collected by this demo.</p></div>
      {loading ? <div className="admin-alert">Loading orders…</div> : user?.role !== "admin" ? <div className="admin-alert"><AlertTriangle size={22}/><span>{message || "Admin access required."} <Link href="/">Return to Flipazon to sign in.</Link></span></div> : <>
        {message && <div className="admin-alert" role="status">{message}</div>}
        {!orders.length ? <section className="admin-card admin-empty-orders"><PackageCheck size={36}/><h2>No orders yet</h2><p>Customer orders will appear here after checkout.</p></section> : <div className="admin-orders-list">{orders.map(order=><article className="admin-order-card" key={order.id}>
          <div className="admin-order-top"><div><span className="admin-order-label">{order.orderNumber}</span><h2>{order.customerName}</h2><p>{order.customerEmail} · {order.phone}</p><small>{new Date(order.createdAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</small></div><span className={`order-status status-${order.status}`}>{statusLabel[order.status] ?? order.status}</span></div>
          <div className="admin-order-address"><Truck size={16}/><span>{order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city}, {order.state} — {order.postalCode}</span></div>
          <div className="admin-order-items">{order.items.map((item,index)=><div className="admin-order-item" key={`${order.id}-${index}`}><img src={item.image} alt=""/><span>{item.name} <small>× {item.quantity}</small></span><b>{currency(item.lineTotal)}</b></div>)}</div>
          <div className="admin-order-bottom"><div><small>COD · PAYMENT PENDING</small><strong>{currency(order.total)}</strong></div><label>Update status<select disabled={busyId===order.id || nextStatuses[order.status]?.length===0} value={order.status} onChange={(e)=>void changeStatus(order,e.target.value)}>{[order.status,...(nextStatuses[order.status]??[])].filter((value,index,all)=>all.indexOf(value)===index).map(status=><option key={status} value={status}>{statusLabel[status]??status}</option>)}</select></label></div>
        </article>)}</div>}
      </>}
      <p className="admin-footnote">Status changes are stored in PostgreSQL. Cancelling a placed/confirmed order restores the reserved stock.</p>
    </main>
  </div>;
}
