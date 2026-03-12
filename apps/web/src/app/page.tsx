"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { MorphyButton } from "@/components/ui/morphy-button";
import StatusIndicator from "@/components/ui/status-indicator";

import { mockRecentFiles } from "@/lib/mock-recent-files";
import { RecentFilesStepper } from "@/components/files/recent-files-stepper";
import { RecentFilesSearch } from "@/components/files/recent-files-search";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type UsageResponse = {
  month: string;
  used: number;
  quota: number;
  remaining: number;
  has_active_subscription: boolean;
};

type OutputState = {
  route?: string;
  status: number;
  sent?: Record<string, unknown>;
  json: unknown;
};

type StatusState = "active" | "idle" | "down" | "fixing";

export default function Home() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

  const [fileQuery, setFileQuery] = useState("");
  const [text, setText] = useState("Hello usage-based API");
  const [apiKey, setApiKey] = useState("");
  const [out, setOut] = useState<OutputState | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);

  const [loadingUsage, setLoadingUsage] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [runningAnalyze, setRunningAnalyze] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);

  const filteredRecentFiles = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();

    if (!q) return mockRecentFiles;

    return mockRecentFiles.filter((file) => {
      return (
        file.name.toLowerCase().includes(q) ||
        file.label.toLowerCase().includes(q) ||
        file.extension.toLowerCase().includes(q)
      );
    });
  }, [fileQuery]);

  const isSearchingFiles = fileQuery.trim().length > 0;

  useEffect(() => {
    const saved = window.localStorage.getItem("ubp_api_key") || "";
    setApiKey(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("ubp_api_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    const key = apiKey.trim();
    if (!key) {
      setUsage(null);
      return;
    }

    void loadUsage(key);
  }, [apiKey]);

  const usagePercent = useMemo(() => {
    if (!usage || usage.quota <= 0) return 0;
    return Math.min((usage.used / usage.quota) * 100, 100);
  }, [usage]);

  const subscriptionStatus = useMemo<{
    state: StatusState;
    label: string;
  }>(() => {
    if (!usage) {
      return { state: "idle", label: "Usage not loaded yet" };
    }

    if (!usage.has_active_subscription) {
      return { state: "down", label: "No active subscription" };
    }

    if (usage.remaining <= 0) {
      return { state: "down", label: "Quota depleted" };
    }

    if (usage.used / usage.quota >= 0.5) {
      return { state: "idle", label: "Halfway used" };
    }

    return { state: "active", label: "Active subscription" };
  }, [usage]);

  async function getSupabaseJwt(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }

  async function loadUsage(overrideKey?: string) {
    const key = (overrideKey ?? apiKey).trim();

    if (!key) {
      setUsage(null);
      setOut({
        route: "/v1/usage",
        status: 401,
        sent: {
          url: `${API_BASE}/v1/usage`,
          hasKey: false,
          authHeaderSet: false,
        },
        json: { detail: "No API key provided" },
      });
      return;
    }

    setLoadingUsage(true);

    try {
      const res = await fetch(`${API_BASE}/v1/usage`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      const json = await res.json().catch(() => ({}));

      setOut({
        route: "/v1/usage",
        status: res.status,
        sent: {
          url: `${API_BASE}/v1/usage`,
          hasKey: Boolean(key),
          authHeaderSet: true,
        },
        json,
      });

      if (res.ok) {
        setUsage(json as UsageResponse);
      } else {
        setUsage(null);
      }
    } finally {
      setLoadingUsage(false);
    }
  }

  async function createApiKey() {
    setCreatingKey(true);
    setOut(null);

    try {
      const jwt = await getSupabaseJwt();

      if (!jwt) {
        setOut({
          route: "/v1/api-keys",
          status: 401,
          sent: {
            url: `${API_BASE}/v1/api-keys`,
            authHeaderSet: false,
            authType: "Supabase JWT",
          },
          json: { detail: "No Supabase session found. Please log in again." },
        });
        return;
      }

      const res = await fetch(`${API_BASE}/v1/api-keys`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "dev key" }),
      });

      const json = await res.json().catch(() => ({}));

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

      if (res.ok && (json as { api_key?: string })?.api_key) {
        const newKey = String((json as { api_key: string }).api_key);
        setApiKey(newKey);
        window.localStorage.setItem("ubp_api_key", newKey);
        await loadUsage(newKey);
      }
    } finally {
      setCreatingKey(false);
    }
  }

  async function runAnalyze() {
    setRunningAnalyze(true);
    setOut(null);

    try {
      const key = (window.localStorage.getItem("ubp_api_key") || "").trim();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (key) headers["Authorization"] = `Bearer ${key}`;

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

      if (res.ok && (json as { usage?: UsageResponse }).usage) {
        setUsage((json as { usage: UsageResponse }).usage);
      } else if (key) {
        await loadUsage(key);
      }
    } finally {
      setRunningAnalyze(false);
    }
  }

  async function startCheckout() {
    setStartingCheckout(true);
    setOut(null);

    try {
      const jwt = await getSupabaseJwt();

      if (!jwt) {
        setOut({
          route: "/v1/billing/checkout-session",
          status: 401,
          sent: {
            url: `${API_BASE}/v1/billing/checkout-session`,
            authHeaderSet: false,
            authType: "Supabase JWT",
          },
          json: { detail: "No Supabase session found. Please log in again." },
        });
        return;
      }

      const res = await fetch(`${API_BASE}/v1/billing/checkout-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      const json = await res.json().catch(() => ({}));

      if ((json as { url?: string })?.url) {
        window.location.href = String((json as { url: string }).url);
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
    } finally {
      setStartingCheckout(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <section className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          Usage-Based API Platform
        </h1>
        <p className="text-muted-foreground">
          API key → /v1/analyze. Supabase JWT → /v1/api-keys +
          /v1/billing/checkout-session.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6 rounded-xl border bg-card p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Developer Access</h2>
            <p className="text-sm text-muted-foreground">
              Manage your dev API key and use it for protected API calls.
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="api-key-input">API Key (dev-only)</FieldLabel>
            <input
              id="api-key-input"
              type="text"
              placeholder="ubp_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none"
            />
            <FieldDescription>
              Saved locally as <code>ubp_api_key</code>.
            </FieldDescription>
          </Field>

          <div className="flex flex-wrap gap-3">
            <MorphyButton onClick={createApiKey} disabled={creatingKey}>
              {creatingKey ? "Creating..." : "Create API Key"}
            </MorphyButton>

            <MorphyButton
              animate="reverse"
              onClick={() => loadUsage()}
              disabled={loadingUsage}
            >
              {loadingUsage ? "Refreshing..." : "Refresh Usage"}
            </MorphyButton>
          </div>

          <Field>
            <FieldLabel htmlFor="analyze-text">Analyze Text</FieldLabel>
            <textarea
              id="analyze-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="flex min-h-[140px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none"
            />
            <FieldDescription>
              Send text to <code>/v1/analyze</code> using the current API key.
            </FieldDescription>
          </Field>

          <div className="flex flex-wrap gap-3">
            <MorphyButton
              size="lg"
              onClick={runAnalyze}
              disabled={runningAnalyze}
            >
              {runningAnalyze ? "Calling..." : "Call /v1/analyze"}
            </MorphyButton>

            <MorphyButton
              size="lg"
              animate="reverse"
              onClick={startCheckout}
              disabled={startingCheckout}
            >
              {startingCheckout ? "Starting..." : "Start Stripe Checkout"}
            </MorphyButton>
          </div>
        </div>

        <div className="space-y-6 rounded-xl border bg-card p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Subscription & Usage</h2>
            <p className="text-sm text-muted-foreground">
              Live usage state from <code>/v1/usage</code>.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <StatusIndicator
              state={subscriptionStatus.state}
              label={subscriptionStatus.label}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Current month</div>
              <div className="mt-2 text-2xl font-semibold">
                {usage?.month ?? "--"}
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Usage</div>
              <div className="mt-2 text-2xl font-semibold">
                {usage ? `${usage.used} / ${usage.quota}` : "-- / --"}
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Remaining</div>
              <div className="mt-2 text-2xl font-semibold">
                {usage?.remaining ?? "--"}
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Subscription</div>
              <div className="mt-2 text-2xl font-semibold">
                {usage
                  ? usage.has_active_subscription
                    ? "Active"
                    : "Inactive"
                  : "--"}
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Quota usage</span>
              <span>{Math.round(usagePercent)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <RecentFilesStepper
          files={filteredRecentFiles}
          paused={isSearchingFiles}
        />

        <RecentFilesSearch
          query={fileQuery}
          onQueryChange={setFileQuery}
          results={filteredRecentFiles}
        />
      </section>

      <section className="rounded-xl border bg-card p-6">
        <div className="mb-3 space-y-1">
          <h2 className="text-xl font-semibold">API Response</h2>
          <p className="text-sm text-muted-foreground">
            Latest response from the platform.
          </p>
        </div>

        <pre className="overflow-auto rounded-lg bg-black p-4 text-sm text-green-400">
          {out ? JSON.stringify(out, null, 2) : "Output..."}
        </pre>
      </section>
    </main>
  );
}