"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Boxes, CircleAlert, ClipboardList, ImagePlus, LayoutDashboard, Plus, RefreshCw, Save, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { categories, currency, type Product } from "@/data/catalog";

type AdminProduct = Product & { stock:number };
type Stats = { users:number; products:number; stock:number };
type User = { name:string; email:string; role:string };
type Form = { name:string;brand:string;category:string;price:string;originalPrice:string;stock:string;image:string;description:string };
const emptyForm: Form = { name:"",brand:"",category:"electronics",price:"",originalPrice:"",stock:"25",image:"",description:"" };

export default function AdminPanel() {
  const [user,setUser] = useState<User|null>(null);
  const [loading,setLoading] = useState(true);
  const [products,setProducts] = useState<AdminProduct[]>([]);
  const [stats,setStats] = useState<Stats|null>(null);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [uploadingImage,setUploadingImage] = useState(false);
  const [editing,setEditing] = useState<number|null>(null);
  const [form,setForm] = useState<Form>(emptyForm);

  const refresh = useCallback(async () => {
    try {
      const [me,inventory,counts] = await Promise.all([
        fetch("/api/auth/me",{cache:"no-store"}),
        fetch("/api/admin/products",{cache:"no-store"}),
        fetch("/api/admin/stats",{cache:"no-store"}),
      ]);
      const meData = await me.json();
      setUser(meData.user ?? null);
      if (!inventory.ok || !counts.ok) {
        setMessage(meData.user?.role === "admin" ? "Can't load dashboard. Check PostgreSQL setup." : "Admin access required. Sign in with an admin account.");
        return;
      }
      setProducts((await inventory.json()).products);
      setStats((await counts.json()).stats);
      setMessage("");
    } catch { setMessage("Backend unavailable. Start PostgreSQL and Next.js."); }
    finally { setLoading(false); }
  },[]);
  useEffect(() => { void refresh(); },[refresh]);

  const updateField = (name:keyof Form,value:string) => setForm((old)=>({...old,[name]:value}));
  const startEdit = (p:AdminProduct) => {
    setEditing(p.id);
    setForm({ name:p.name,brand:p.brand,category:p.category,price:String(p.price),originalPrice:String(p.originalPrice),stock:String(p.stock),image:p.image,description:p.description });
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const reset = () => { setEditing(null);setForm(emptyForm); };
  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setMessage("Choose a JPG, PNG, or WEBP image.");
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be 5 MB or smaller.");
      input.value = "";
      return;
    }
    setUploadingImage(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("image", file);
      const response = await fetch("/api/admin/uploads/products", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Image upload failed");
      updateField("image", result.image);
      setMessage("Image uploaded. Click Add product or Save changes to save it to this product.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadingImage(false);
      input.value = "";
    }
  }
  async function saveProduct(event:FormEvent) {
    event.preventDefault();
    if (!form.image) { setMessage("Please upload a product image before saving."); return; }
    setBusy(true); setMessage("");
    try {
      const body = { ...form,price:Number(form.price),originalPrice:Number(form.originalPrice),stock:Number(form.stock) };
      const response = await fetch(editing ? `/api/admin/products/${editing}` : "/api/admin/products", {
        method: editing ? "PATCH" : "POST",headers:{ "Content-Type":"application/json" },body:JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save product");
      reset(); await refresh();setMessage(editing ? "Product updated successfully." : "Product added to Flipazon.");
    } catch(error) {setMessage(error instanceof Error ? error.message : "Request failed");}
    finally {setBusy(false);}
  }
  async function archiveProduct(id:number) {
    if (!window.confirm("Hide this product from Flipazon?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/products/${id}`,{method:"DELETE"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Couldn't archive product");
      await refresh(); setMessage("Product hidden from storefront.");
    } catch(error) {setMessage(error instanceof Error ? error.message : "Request failed");}
    finally {setBusy(false);}
  }
  return (
    <div className="admin-page">
      <header className="admin-header"><div className="container admin-header-inner"><Link href="/" className="admin-back"><ArrowLeft size={19}/> Shop Flipazon</Link><span className="admin-logo">Flip<span>azon</span><b> ADMIN</b></span><button onClick={()=>void refresh()} className="admin-refresh"><RefreshCw size={17}/> Refresh</button></div></header>
      <main className="container admin-main">
        <div className="admin-hero"><span className="admin-eyebrow"><ShieldCheck size={15}/> PRIVATE ADMIN AREA</span><h1><LayoutDashboard size={32}/> Flipazon Dashboard</h1><p>Manage your products, prices, inventory and customer orders with PostgreSQL.</p><Link className="admin-orders-link" href="/admin/orders"><ClipboardList size={15}/> Manage customer orders</Link></div>
        {loading ? <div className="admin-alert">Loading dashboard...</div> : user?.role !== "admin" ? <div className="admin-alert"><CircleAlert size={23}/><span>{message || "Admin access required."} <Link href="/">Return to Flipazon to sign in.</Link></span></div> : <>
          {message && <div className="admin-alert" role="status">{message}</div>}
          <div className="admin-stats"><div><Users size={22}/><span>Registered users</span><strong>{stats?.users ?? 0}</strong></div><div><Boxes size={22}/><span>Live products</span><strong>{stats?.products ?? 0}</strong></div><div><ShieldCheck size={22}/><span>Units in stock</span><strong>{stats?.stock ?? 0}</strong></div></div>
          <section className="admin-card" aria-label="Product form"><div className="admin-section-title"><h2>{editing ? `Edit product #${editing}` : "Add new product"}</h2>{editing && <button className="admin-muted" onClick={reset}><X size={17}/> Cancel edit</button>}</div>
            <form className="admin-form" onSubmit={(e)=>void saveProduct(e)}>
              <label>Product name<input required minLength={3} maxLength={160} value={form.name} onChange={(e)=>updateField("name",e.target.value)} placeholder="e.g. Headphones" /></label>
              <label>Brand<input required minLength={2} maxLength={80} value={form.brand} onChange={(e)=>updateField("brand",e.target.value)} placeholder="e.g. Flipazon Basics" /></label>
              <label>Category<select value={form.category} onChange={(e)=>updateField("category",e.target.value)}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <div className="admin-image-upload admin-wide">
                <div className="admin-image-preview">
                  {form.image ? <img src={form.image} alt="Selected product preview" /> : <div className="admin-image-empty"><ImagePlus size={30}/><span>No image selected</span></div>}
                  <div><strong>Product image preview</strong><small>{form.image.startsWith("/uploads/") ? "Your uploaded image" : form.image ? "Current product image" : "Upload an image to continue"}</small>{form.image && <small className="admin-image-path">{form.image}</small>}</div>
                </div>
                <div className="admin-image-controls">
                  <div className="admin-upload-dropzone">
                    <ImagePlus size={27} aria-hidden="true" />
                    <strong>Upload product image</strong>
                    <p>Choose an image from your computer</p>
                    <small>JPG, PNG or WEBP · Maximum 5 MB</small>
                    <label className="admin-upload-button" htmlFor="flipazon-product-image">{uploadingImage ? "Uploading image…" : "Choose image"}</label>
                    <input id="flipazon-product-image" className="admin-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>void uploadImage(e)} disabled={uploadingImage || busy} />
                  </div>
                  {uploadingImage && <p className="admin-upload-status" role="status">Uploading image… Please wait.</p>}
                </div>
              </div>
              <label>Price (₹)<input type="number" required min={1} max={10000000} step={1} value={form.price} onChange={(e)=>updateField("price",e.target.value)} /></label>
              <label>Original price (₹)<input type="number" required min={1} max={10000000} step={1} value={form.originalPrice} onChange={(e)=>updateField("originalPrice",e.target.value)} /></label>
              <label>Stock units<input type="number" required min={0} max={100000} step={1} value={form.stock} onChange={(e)=>updateField("stock",e.target.value)} /></label>
              <label className="admin-wide">Description<textarea rows={3} maxLength={1500} value={form.description} onChange={(e)=>updateField("description",e.target.value)} /></label>
              <button className="btn-yellow admin-save" type="submit" disabled={busy || uploadingImage}>{editing ? <Save size={18}/> : <Plus size={18}/>} {busy ? "Saving..." : editing ? "Save changes" : "Add product"}</button>
            </form>
          </section>
          <section className="admin-card"><div className="admin-section-title"><h2>Product inventory</h2><span>{products.length} visible products</span></div>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><div className="admin-product"><img src={p.image} alt=""/><div><strong>{p.name}</strong><small>#{p.id} · {p.brand}</small></div></div></td><td>{p.category}</td><td>{currency(p.price)}</td><td><span className={p.stock === 0 ? "admin-out-stock" : ""}>{p.stock}</span></td><td><div className="admin-actions"><button disabled={busy} onClick={()=>startEdit(p)}>Edit</button><button disabled={busy} onClick={()=>void archiveProduct(p.id)} aria-label={`Hide ${p.name}`}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table></div>
          </section>
        </>}
        <p className="admin-footnote">Phase 3 development dashboard. Checkout supports local Cash on Delivery orders; online payments and shipping integrations are not active.</p>
      </main>
    </div>
  );
}
