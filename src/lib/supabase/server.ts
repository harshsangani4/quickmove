/**
 * Server-side Supabase client bound to the request's auth cookies (RLS-enforced).
 * Use in ops server components / server actions / route handlers so that
 * city-scoped Row-Level Security applies to the signed-in ops user.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component without a response to mutate — safe to
          // ignore when middleware is refreshing the session.
        }
      },
    },
  });
}
