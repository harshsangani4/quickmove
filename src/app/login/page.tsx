"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Compass, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Couldn't sign in", { description: error.message });
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  function fill(demo: string) {
    setEmail(demo);
    setPassword("quickmove123");
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gradient-to-br from-background via-background to-brand-muted/40 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Compass className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">QuickMove Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to coordinate every move.
          </p>
        </div>

        <form
          onSubmit={signIn}
          className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@quickmove.in"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        <div className="mt-6 rounded-xl border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Demo accounts (password: quickmove123)</p>
          <div className="flex flex-wrap gap-2">
            {[
              ["Admin", "admin@quickmove.in"],
              ["Lead", "lead@quickmove.in"],
              ["Ops · BLR/HYD", "rahul@quickmove.in"],
              ["Ops · KOL/AMD", "anjali@quickmove.in"],
            ].map(([label, mail]) => (
              <button
                key={mail}
                type="button"
                onClick={() => fill(mail)}
                className="rounded-md border bg-background px-2 py-1 transition hover:border-brand hover:text-brand"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
