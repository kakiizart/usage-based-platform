"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loadingAction, setLoadingAction] = useState<"signin" | "signup" | null>(null);

  async function signIn() {
    setLoadingAction("signin");
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoadingAction(null);
      return;
    }

    window.location.href = "/";
  }

  async function signUp() {
    setLoadingAction("signup");
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoadingAction(null);
      return;
    }

    setMessage("Account created. Check your email if confirmation is enabled.");
    setLoadingAction(null);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Login</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage API keys, billing, and usage.
          </p>
        </div>

        <div className="space-y-5">
          <Field>
            <FieldLabel htmlFor="login-email">
              Email <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <FieldDescription>
              Use the same email tied to your Supabase account.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="login-password">
              Password <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <FieldDescription>
              Keep it secret. Password goblins are real.
            </FieldDescription>
          </Field>

          {message ? (
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
              {message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={signIn} disabled={loadingAction !== null}>
              {loadingAction === "signin" ? "Signing in..." : "Sign in"}
            </Button>

            <Button
              variant="outline"
              onClick={signUp}
              disabled={loadingAction !== null}
            >
              {loadingAction === "signup" ? "Signing up..." : "Sign up"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}