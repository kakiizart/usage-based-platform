"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function Home() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Create supabase client once
  const supabase = useMemo(() => createClient(SUPABASE_URL, SUPABASE_ANON), [SUPABASE_URL, SUPABASE_ANON]);

  const [text, setText] = useState("Hello usage-based API");
  const [out, setOut] = useState<any>(null);
  const [apiKey, setApiKey] = useState("");

  // Load saved API key on first render
  useEffect(() => {
    const saved = window.localStorage.getItem("ubp_api_key") || "";
    setApiKey(saved);
  }, []);

  // Save API key whenever it changes
  useEffect(() => {
    window.localStorage.setItem("ubp_api_key", apiKey);
  }, [apiKey]);

  async function getSupabaseAccessToken(): Promise<string | null> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("supabase.auth.getSession error:", error);
      return null;
    }
    return session?.access_token ?? null;
  }

  async function runAnalyze() {
    setOut(null);

    const key = (window.localStorage.getItem("ubp_api_key") || "").trim();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (key) headers["Authorization"] = `Bearer ${key}`;

    // Debug
    console.log("[analyze] API_BASE:", API_BASE);
    console.log("[analyze] url:", `${API_BASE}/v1/analyze`);
    console.log("[analyze] hasKey:", Boolean(key));
    console.log("[analyze] authHeaderSet:", Boolean(headers["Authorization"]));

    const res = await fetch(`${API_BASE}/v1/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text }),
    });

    const json = await res.json().catch(() => ({}));
    setOut({
      route: "/v1/analyze",
      status: res.status,
      sent: {
        url: `${API_BASE}/v1/analyze`,
        hasKey: Boolean(key),
        authHeaderSet: Boolean(headers["Authorization"]),
      },
      json,
    });
  }

  async function createApiKey() {
    setOut(null);

    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) {
      setOut({
        route: "/v1/api-keys",
        status: 401,
        json: { detail: "No Supabase session found. Please log in again." },
      });
      return;
    }

    // Debug
    console.log("[createApiKey] url:", `${API_BASE}/v1/api-keys`);
    console.log("[createApiKey] hasSupabaseJWT:", Boolean(accessToken));

    const res = await fetch(`${API_BASE}/v1/api-keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`, // <-- Supabase JWT (NOT api key)
      },
      body: JSON.stringify({ name: "dev key" }),
    });

    const json = await res.json().catch(() => ({}));

    // Your backend returns: { api_key: "...", prefix: "..." }
    if (res.ok && json?.api_key) {
      setApiKey(json.api_key);
      window.localStorage.setItem("ubp_api_key", json.api_key);
    }

    setOut({
      route: "/v1/api-keys",
      status: res.status,
      sent: {
        url: `${API_BASE}/v1/api-keys`,
        authHeaderSet: true,
        authType: "Supabase JWT",
      },
      json,
    });
  }

  async function startCheckout() {
    setOut(null);

    const accessToken = await getSupabaseAccessToken();
    if (!accessToken) {
      setOut({
        route: "/v1/billing/checkout-session",
        status: 401,
        json: { detail: "No Supabase session found. Please log in again." },
      });
      return;
    }

    // Debug
    console.log("[checkout] url:", `${API_BASE}/v1/billing/checkout-session`);
    console.log("[checkout] hasSupabaseJWT:", Boolean(accessToken));

    const res = await fetch(`${API_BASE}/v1/billing/checkout-session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`, // <-- Supabase JWT (NOT api key)
      },
    });

    const json = await res.json().catch(() => ({}));

    if (res.ok && json?.url) {
      window.location.href = json.url;
      return;
    }

    setOut({
      route: "/v1/billing/checkout-session",
      status: res.status,
      sent: {
        url: `${API_BASE}/v1/billing/checkout-session`,
        authHeaderSet: true,
        authType: "Supabase JWT",
      },
      json,
    });
  }

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Usage-Based API Platform</h1>
      <p>API key → /v1/analyze. Supabase JWT → /v1/api-keys + /v1/billing/checkout-session.</p>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>API Key (dev-only)</label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="ubp_..."
          style={{ width: "100%", padding: 12 }}
        />
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          Saved locally as <code>ubp_api_key</code>.
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button onClick={createApiKey} style={{ padding: "10px 14px" }}>
            Create API Key
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} style={{ width: "100%", padding: 12 }} />
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