export function getAllowedHostsFromEnv(envVar = 'ALLOWED_LLM_HOSTS'): Set<string> {
  const raw = process.env[envVar] || 'localhost,127.0.0.1';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAllowedHost(urlString: string, allowEnvVar?: string): boolean {
  try {
    const url = new URL(urlString);
    const allowed = getAllowedHostsFromEnv(allowEnvVar);
    return allowed.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function normalizeHttpUrl(urlString: string): string | null {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
