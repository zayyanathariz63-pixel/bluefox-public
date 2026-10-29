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
      "tmpa_mcp_supabase_client_id"
    ], "");
  },
  get google(): string {
    return getEnvAny([
      "VITE_GOOGLE_CLIENT_ID",
      "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_ID",
      "tmpa_mcp_google_client_id"
    ], "");
  },
  get github(): string {
    return getEnvAny([
      "VITE_GITHUB_CLIENT_ID",
      "NEXT_PUBLIC_GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_ID",
      "tmpa_mcp_github_client_id"
    ], "");
  },
  get vercel(): string {
    return getEnvAny([
      "VITE_VERCEL_CLIENT_ID",
      "NEXT_PUBLIC_VERCEL_CLIENT_ID",
      "VERCEL_CLIENT_ID",
      "tmpa_mcp_vercel_client_id"
    ], "");
  },
  get netlify(): string {
    return getEnvAny([
      "VITE_NETLIFY_CLIENT_ID",
      "NEXT_PUBLIC_NETLIFY_CLIENT_ID",
      "NETLIFY_CLIENT_ID",
      "tmpa_mcp_netlify_client_id"
    ], "");
  },
  get figma(): string {
    return getEnvAny([
      "VITE_FIGMA_CLIENT_ID",
      "NEXT_PUBLIC_FIGMA_CLIENT_ID",
      "FIGMA_CLIENT_ID",
      "tmpa_mcp_figma_client_id"
    ], "");
  },
  get airtable(): string {
    return getEnvAny([
      "VITE_AIRTABLE_CLIENT_ID",
      "NEXT_PUBLIC_AIRTABLE_CLIENT_ID",
      "AIRTABLE_CLIENT_ID",
      "tmpa_mcp_airtable_client_id"
    ], "");
  },
  get canva(): string {
    return getEnvAny([
      "VITE_CANVA_CLIENT_ID",
      "NEXT_PUBLIC_CANVA_CLIENT_ID",
      "CANVA_CLIENT_ID",
      "tmpa_mcp_canva_client_id"
    ], "");
  },
};

/**
 * Validasi apakah Client ID adalah nilai nyata (bukan placeholder dummy)
 */
export function isValidClientId(clientId: string): boolean {
  if (!clientId || typeof clientId !== 'string') return false;
  const trimmed = clientId.trim();
  if (trimmed.length < 5) return false;
  if (
    trimmed.includes('YOUR_') || 
    trimmed.endsWith('-client') || 
    trimmed === 'google-client' ||
    trimmed === 'supabase-client' ||
    trimmed === 'vercel-client' ||
    trimmed === 'github-client'
  ) {
    return false;
  }
  return true;
}

/**
 * Menyimpan Client ID kustom secara lokal (misal jika belum sempat redeploy di Vercel)
 */
export function setProviderClientId(providerId: string, clientId: string): void {
  if (typeof window !== 'undefined') {
    const key = `tmpa_mcp_${providerId.toLowerCase()}_client_id`;
    if (clientId && clientId.trim()) {
      localStorage.setItem(key, clientId.trim());
      // Kompatibilitas format umum
      localStorage.setItem(`VITE_${providerId.toUpperCase()}_CLIENT_ID`, clientId.trim());
    } else {
      localStorage.removeItem(key);
      localStorage.removeItem(`VITE_${providerId.toUpperCase()}_CLIENT_ID`);
    }
  }
}

/**
 * Mendapatkan Client ID untuk provider tertentu dengan deteksi otomatis
 */
export function getProviderClientId(providerId: string): string {
  const pid = (providerId || '').toLowerCase().trim();
  let found = "";

  switch (pid) {
    case "user_supabase":
    case "supabase":
      found = MCP_CLIENT_IDS.supabase;
      break;
    case "google":
      found = MCP_CLIENT_IDS.google;
      break;
    case "github":
      found = MCP_CLIENT_IDS.github;
      break;
    case "vercel":
      found = MCP_CLIENT_IDS.vercel;
      break;
    case "netlify":
      found = MCP_CLIENT_IDS.netlify;
      break;
    case "figma":
      found = MCP_CLIENT_IDS.figma;
      break;
    case "airtable":
      found = MCP_CLIENT_IDS.airtable;
      break;
    case "canva":
      found = MCP_CLIENT_IDS.canva;
      break;
    default:
      found = getEnvAny([
        `VITE_${pid.toUpperCase()}_CLIENT_ID`,
        `NEXT_PUBLIC_${pid.toUpperCase()}_CLIENT_ID`,
        `${pid.toUpperCase()}_CLIENT_ID`,
        `tmpa_mcp_${pid}_client_id`
      ], "");
      break;
  }

  // Cek juga fallback langsung dari localStorage jika build belum ter-update
  if (!found && typeof window !== 'undefined') {
    found = localStorage.getItem(`tmpa_mcp_${pid}_client_id`) || 
            localStorage.getItem(`VITE_${pid.toUpperCase()}_CLIENT_ID`) || 
            localStorage.getItem(`${pid.toUpperCase()}_CLIENT_ID`) || "";
  }

  return (found || "").trim();
}
