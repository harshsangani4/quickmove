/**
 * Typed environment access.
 * Public (NEXT_PUBLIC_*) values are safe in the client bundle.
 * Everything in `serverEnv` is server-only — never import it into a client component.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appBaseUrl: process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000",
};

/**
 * Server-only secrets. Accessing this from a client bundle would tree-shake to
 * empty strings; the explicit guard makes misuse loud during development.
 */
export const serverEnv = {
  get serviceRoleKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  },
  get dbUrl() {
    return process.env.SUPABASE_DB_URL ?? "";
  },
  get openaiApiKey() {
    return process.env.OPENAI_API_KEY ?? "";
  },
  get openaiTextModel() {
    return process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini";
  },
  get openaiVisionModel() {
    return process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
  },
  get magicLinkSecret() {
    return process.env.MAGIC_LINK_SECRET ?? "dev-only-change-me";
  },
  get appBaseUrl() {
    return process.env.APP_BASE_URL ?? "http://localhost:3000";
  },
};
