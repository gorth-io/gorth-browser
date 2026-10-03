/// <reference types="vite/client" />

export const gorthIssuer = import.meta.env.VITE_GORTH_SSO_ISSUER ?? "";
export const gorthClientId =
  import.meta.env.VITE_GORTH_SSO_CLIENT_ID ?? "gorth-browser";
export const gorthRedirectUri =
  import.meta.env.VITE_GORTH_SSO_REDIRECT_URI ??
  "http://127.0.0.1:43822/auth/callback";
