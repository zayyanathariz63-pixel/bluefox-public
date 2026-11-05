/**
 * Utility Sensor / Redaksi Data Sensitif untuk Format JSON, YAML, dan Teks Percakapan
 *
 * Digunakan untuk menyaring dan menyamarkan informasi sensitif saat sesi dibagikan ke publik:
 * - Field sensitif pada JSON: "api_key", "password", "secret", "token", "authorization", dll.
 * - Field sensitif pada YAML/YML: api_key:, password:, secret:, token:, dll.
 * - Kunci token umum: JWT token, sk-..., ghp_..., Private Key blocks, Authorization Bearer.
 */

/**
 * Menyensor data sensitif di dalam teks pesan (khususnya blok JSON, YAML, dan kunci rahasia)
 */
export function censorSensitiveText(text: string): string {
  if (!text) return text;

  let censored = text;

  // 1. Blok Private Key (RSA, OPENSSH, EC, dll)
  censored = censored.replace(
    /-----BEGIN [A-Z0-9 ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]+ PRIVATE KEY-----/gi,
    '-----BEGIN PRIVATE KEY-----\n[REDACTED_PRIVATE_KEY]\n-----END PRIVATE KEY-----'
  );

  // 2. Token JWT (header.payload.signature)
  censored = censored.replace(
    /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
    '[REDACTED_JWT_TOKEN]'
  );

  // 3. API Key pola umum (sk-..., ghp_..., gho_..., xoxb-..., AIza...)
  censored = censored.replace(
    /\b(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|gho_[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35}|xox[baprs]-[0-9a-zA-Z-]{15,})\b/g,
    '[REDACTED_API_KEY]'
  );

  // 4. Header Bearer Token
  censored = censored.replace(
    /(Authorization\s*[:=]\s*['"]?Bearer\s+)[a-zA-Z0-9_\-\.]{15,}(['"]?)/gi,
    '$1[REDACTED_TOKEN]$2'
  );

  // 5. JSON Sensitive Fields Masking (string values)
  // Contoh: "api_key": "secret123", "password": "...", "client_secret": "..."
  const jsonSensitiveKeyPattern = /"(api[_-]?key|apikey|secret|client[_-]?secret|secret[_-]?key|app[_-]?secret|password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|auth[_-]?token|authorization|private[_-]?key|credentials|database[_-]?url)"\s*:\s*"([^"]+)"/gi;
  censored = censored.replace(jsonSensitiveKeyPattern, (match, key) => {
    return `"${key}": "********"`;
  });

  // JSON Sensitive Fields Masking (numeric or boolean values if any)
  const jsonNumericSensitiveKeyPattern = /"(password|token|secret|pin)"\s*:\s*([0-9]{4,})/gi;
  censored = censored.replace(jsonNumericSensitiveKeyPattern, (match, key) => {
    return `"${key}": "********"`;
  });

  // 6. YAML Sensitive Fields Masking
  // Contoh:
  // api_key: "secret123"
  // password: mypassword
  // token: 'xyz'
  const yamlKeyPattern = /(^|[\r\n])(\s*)(api[_-]?key|apikey|secret|client[_-]?secret|secret[_-]?key|app[_-]?secret|password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|auth[_-]?token|authorization|private[_-]?key|credentials|database[_-]?url)\s*:\s*(['"]?)([^\r\n#]+)(['"]?)/gi;
  censored = censored.replace(yamlKeyPattern, (match, prefix, indent, key, q1, val, q2) => {
    return `${prefix}${indent}${key}: "********"`;
  });

  return censored;
}

/**
 * Sensor seluruh pesan di dalam daftar pesan percakapan
 */
export function censorSessionMessages(messages: any[]): any[] {
  if (!messages || !Array.isArray(messages)) return [];

  return messages.map(msg => {
    const copy = { ...msg };
    if (copy.text) {
      copy.text = censorSensitiveText(copy.text);
    }
    if (copy.media) {
      if (Array.isArray(copy.media)) {
        copy.media = copy.media.map((m: any) => ({
          ...m,
          textContent: m.textContent ? censorSensitiveText(m.textContent) : undefined
        }));
      } else if (copy.media.textContent) {
        copy.media = {
          ...copy.media,
          textContent: censorSensitiveText(copy.media.textContent)
        };
      }
    }
    return copy;
  });
}
