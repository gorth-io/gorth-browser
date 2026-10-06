export interface ShieldPreferences {
  enabled: boolean;
  automaticUpdates: boolean;
  disabledSites: string[];
  customFilters: string;
}

export interface ShieldStatus {
  preferences: ShieldPreferences;
  ready: boolean;
  updating: boolean;
  updatedAt: number | null;
  blockedRequests: number;
  error: string | null;
}

export const defaultShieldPreferences: ShieldPreferences = {
  enabled: true,
  automaticUpdates: true,
  disabledSites: [],
  customFilters: "",
};

export function normalizeSite(value: string) {
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Enter an HTTP(S) website hostname.");
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

export function isSiteExcluded(url: string, sites: string[]) {
  try {
    const hostname = normalizeSite(url);
    return sites.some(
      (site) => hostname === site || hostname.endsWith(`.${site}`),
    );
  } catch {
    return true;
  }
}
