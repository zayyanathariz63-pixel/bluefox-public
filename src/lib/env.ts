/**
 * Universal Environment Variable Helper
 * Mendeteksi dan membaca secara otomatis seluruh environment variable dari:
 * - Vercel Next.js (`NEXT_PUBLIC_*`, `VERCEL_*`, `SUPABASE_*`)
 * - Vite (`VITE_*`)
 * - Node/Server (`process.env.*`)
 * - Runtime browser (`window.__ENV__` atau `localStorage`)
 */

// Helper aman untuk mengekstrak nilai environment dari berbagai sumber
export function getEnv(key: string, fallback: string = ""): string {
  // 1. Cek import.meta.env (Vite)
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv && metaEnv[key] !== undefined && metaEnv[key] !== null && String(metaEnv[key]).trim() !== "") {
      return String(metaEnv[key]).trim();
    }
  } catch {}

  // 2. Cek process.env jika tersedia
  try {
    if (typeof process !== "undefined" && process.env) {
      const procVal = process.env[key];
      if (procVal !== undefined && procVal !== null && String(procVal).trim() !== "") {
        return String(procVal).trim();
      }
    }
  } catch {}

  // 3. Cek window.__ENV__ atau localStorage di browser
  if (typeof window !== "undefined") {
    try {
      const winEnv = (window as any).__ENV__;
      if (winEnv && winEnv[key]) {
        return String(winEnv[key]).trim();
      }
      const stored = window.localStorage.getItem(key);
      if (stored && stored.trim() !== "") {
        return stored.trim();
      }
    } catch {}
  }

  return fallback;
}

/**
 * Mencari nilai pertama yang cocok dari daftar nama kunci alternatif (alias)
 */
export function getEnvAny(keys: string[], fallback: string = ""): string {
  for (const k of keys) {
    const val = getEnv(k);
    if (val) return val;
  }
  return fallback;
}

// ----------------------------------------------------
// SUPABASE KEYS & INTEGRASI VERCEL
// ----------------------------------------------------
export const SUPABASE_CONFIG = {
  get url(): string {
    return getEnvAny(
      [
        "VITE_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_URL",
        "PUBLIC_SUPABASE_URL",
      ],
      "https://jjlanjshpyklqayjzxyy.supabase.co"
    );
  },
  get anonKey(): string {
    return getEnvAny(
      [
        "VITE_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_ANON_KEY",
        "SUPABASE_KEY",
        "VITE_SUPABASE_KEY",
        "PUBLIC_SUPABASE_ANON_KEY",
      ],
      "sb_publishable_zXY2aPqOnPt7j1QKdoZFxQ_x6rOon0U"
    );
  },
  get serviceRoleKey(): string {
    return getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"]);
  },
};

// ----------------------------------------------------
// MCP PLATFORM CLIENT IDS (OAuth & Integrations)
// Mendeteksi format VITE_* (Vite React) dan NEXT_PUBLIC_* (Next.js)
// ----------------------------------------------------
export const MCP_CLIENT_IDS = {
  get supabase(): string {
    return getEnvAny([
      "VITE_SUPABASE_CLIENT_ID",
      "NEXT_PUBLIC_SUPABASE_CLIENT_ID",
      "SUPABASE_CLIENT_ID",
    ], "supabase-client");
  },
  get google(): string {
    return getEnvAny([
      "VITE_GOOGLE_CLIENT_ID",
      "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_ID",
    ], "google-client");
  },
  get github(): string {
    return getEnvAny([
      "VITE_GITHUB_CLIENT_ID",
      "NEXT_PUBLIC_GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_ID",
    ], "github-client");
  },
  get vercel(): string {
    return getEnvAny([
      "VITE_VERCEL_CLIENT_ID",
      "NEXT_PUBLIC_VERCEL_CLIENT_ID",
      "VERCEL_CLIENT_ID",
    ], "vercel-client");
  },
  get netlify(): string {
    return getEnvAny([
      "VITE_NETLIFY_CLIENT_ID",
      "NEXT_PUBLIC_NETLIFY_CLIENT_ID",
      "NETLIFY_CLIENT_ID",
    ], "netlify-client");
  },
  get figma(): string {
    return getEnvAny([
      "VITE_FIGMA_CLIENT_ID",
      "NEXT_PUBLIC_FIGMA_CLIENT_ID",
      "FIGMA_CLIENT_ID",
    ], "figma-client");
  },
  get airtable(): string {
    return getEnvAny([
      "VITE_AIRTABLE_CLIENT_ID",
      "NEXT_PUBLIC_AIRTABLE_CLIENT_ID",
      "AIRTABLE_CLIENT_ID",
    ], "airtable-client");
  },
  get canva(): string {
    return getEnvAny([
      "VITE_CANVA_CLIENT_ID",
      "NEXT_PUBLIC_CANVA_CLIENT_ID",
      "CANVA_CLIENT_ID",
    ], "canva-client");
  },
};

/**
 * Mendapatkan Client ID untuk provider tertentu dengan deteksi otomatis
 */
export function getProviderClientId(providerId: string): string {
  switch (providerId) {
    case "user_supabase":
    case "supabase":
      return MCP_CLIENT_IDS.supabase;
    case "google":
      return MCP_CLIENT_IDS.google;
    case "github":
      return MCP_CLIENT_IDS.github;
    case "vercel":
      return MCP_CLIENT_IDS.vercel;
    case "netlify":
      return MCP_CLIENT_IDS.netlify;
    case "figma":
      return MCP_CLIENT_IDS.figma;
    case "airtable":
      return MCP_CLIENT_IDS.airtable;
    case "canva":
      return MCP_CLIENT_IDS.canva;
    default:
      return getEnvAny([
        `VITE_${providerId.toUpperCase()}_CLIENT_ID`,
        `NEXT_PUBLIC_${providerId.toUpperCase()}_CLIENT_ID`,
        `${providerId.toUpperCase()}_CLIENT_ID`,
      ]);
  }
}
