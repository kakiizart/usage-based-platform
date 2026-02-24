"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function signUp() {
    setMsg(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setMsg(error ? error.message : "Signed up. Check email if confirmation is enabled.");
  }

  async function signIn() {
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMsg(error ? error.message : "Signed in.");
  }

  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Login</h1>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 10 }} />
      <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 10 }} />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button onClick={signIn} style={{ padding: "10px 14px" }}>Sign in</button>
        <button onClick={signUp} style={{ padding: "10px 14px" }}>Sign up</button>
      </div>
      <pre style={{ marginTop: 12 }}>{msg ?? ""}</pre>
    </main>
  );
}