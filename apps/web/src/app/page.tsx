"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const [text, setText] = useState("Hello usage-based API");
  const [out, setOut] = useState<any>(null);

  async function runAnalyze() {
    setOut(null);
    const res = await fetch(`${API_BASE}/v1/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const json = await res.json();
    setOut({ status: res.status, json });
  }

  async function startCheckout() {
    setOut(null);

    // Get current Supabase session
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setOut({
        status: 401,
        json: { error: "Not logged in. Go to /login first." },
      });
      return;
    }

    const res = await fetch(`${API_BASE}/v1/billing/checkout-session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const json = await res.json();

    if (json.url) {
      window.location.href = json.url;
    } else {
      setOut({ status: res.status, json });
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>
        Usage-Based API Platform
      </h1>
      <p>
        Local MVP shell: analyze endpoint + Stripe checkout session stub.
      </p>

      <div style={{ marginTop: 16 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ width: "100%", padding: 12 }}
        />
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button onClick={runAnalyze} style={{ padding: "10px 14px" }}>
            Call /v1/analyze
          </button>
          <button onClick={startCheckout} style={{ padding: "10px 14px" }}>
            Start Stripe Checkout
          </button>
        </div>
      </div>

      <pre
        style={{
          marginTop: 16,
          background: "#111",
          color: "#0f0",
          padding: 12,
          overflow: "auto",
        }}
      >
        {out ? JSON.stringify(out, null, 2) : "Output..."}
      </pre>
    </main>
  );
}