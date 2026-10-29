"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, LogOut, Mail, ShieldCheck, UserRound, X } from "lucide-react";

export type SignedInUser = { id: number; name: string; email: string; role: "customer" | "admin" };
export default function AccountModal({ user, close, onAuthenticated, onLogout }: {
  user: SignedInUser | null;
  close: () => void;
  onAuthenticated: (user: SignedInUser) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [mode,setMode] = useState<"login" | "signup">("login");
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login",{
        method:"POST",headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({name,email,password}),credentials:"same-origin",
      });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || "Sign in failed");
      await onAuthenticated(data.user);
      setPassword(""); close();
    } catch (err) { setError(err instanceof Error ? err.message : "Please try again"); }
    finally {setBusy(false);}
  }

  return <div className="overlay modal-overlay" onMouseDown={close}>
    <div className="account-modal auth-modal" role="dialog" aria-modal="true" aria-label={user ? "Your account" : "Sign in or sign up"} onMouseDown={(e)=>e.stopPropagation()}>
      <button type="button" className="modal-close" aria-label="Close account modal" onClick={close}><X size={21}/></button>
      <span className="account-circle"><UserRound size={34}/></span>
      {user ? <>
        <h2>Welcome, {user.name}! <span>👋</span></h2>
        <p>You’re signed in as <strong>{user.email}</strong>. Your cart and wishlist are saved in your Flipazon account.</p>
        <div className="auth-status"><ShieldCheck size={19}/> Active account · {user.role === "admin" ? "Administrator" : "Customer"}</div>
        <Link className="btn-yellow auth-admin-link" href="/orders" onClick={close}>View my orders <ArrowRight size={18}/></Link>
        {user.role === "admin" && <Link className="btn-yellow auth-admin-link" href="/admin" onClick={close}>Open admin dashboard <ArrowRight size={18}/></Link>}
        <button className="auth-logout" disabled={busy} onClick={async () => { setBusy(true);setError("");try {await onLogout();close();} catch(err) {setError(err instanceof Error ? err.message : "Logout failed");}finally{setBusy(false);} }}><LogOut size={19}/> Sign out</button>
      </> : <>
        <h2>{mode === "login" ? "Welcome back!" : "Join Flipazon"} <span>✨</span></h2>
        <p>{mode === "login" ? "Sign in to keep your wishlist and cart across devices." : "Create your free account to start shopping smarter."}</p>
        <div className="auth-tabs" role="tablist" aria-label="Account options"><button type="button" role="tab" aria-selected={mode==="login"} className={mode==="login" ? "active" : ""} onClick={()=>{setMode("login");setError("");}}>Sign in</button><button type="button" role="tab" aria-selected={mode==="signup"} className={mode==="signup" ? "active" : ""} onClick={()=>{setMode("signup");setError("");}}>Create account</button></div>
        <form className="auth-form" onSubmit={(e)=>void submit(e)}>
          {mode === "signup" && <label>Your full name<input autoComplete="name" minLength={2} maxLength={80} required placeholder="Your name" value={name} onChange={(e)=>setName(e.target.value)}/></label>}
          <label><Mail size={15}/> Email<input type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" value={email} onChange={(e)=>setEmail(e.target.value)}/></label>
          <label><LockKeyhole size={15}/> Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 10} placeholder={mode === "signup" ? "At least 10 characters" : "Your password"} value={password} onChange={(e)=>setPassword(e.target.value)} /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="btn-yellow auth-submit" disabled={busy} type="submit">{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create free account"} <ArrowRight size={18}/></button>
        </form>
        <div className="auth-secure-note"><ShieldCheck size={17}/> Secure server-side sessions. Demo store: no real payments.</div>
      </>}
      {user && error && <div className="auth-error" role="alert">{error}</div>}
    </div>
  </div>;
}
