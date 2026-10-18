const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
export const supabaseConfig = { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_PUBLISHABLE_KEY };
export const supabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.key);
