export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  binding: string;
}
export interface AuthSession {
  id: string;
  name: string;
  email?: string;
  username?: string;
  image?: string;
  emailVerified?: boolean;
  tokens: Tokens;
}
export interface AuthSnapshot {
  user: {
    id: string;
    name: string;
    email?: string;
    username?: string;
    image?: string;
    emailVerified?: boolean;
    expiresAt: number;
    canRefresh?: boolean;
    needsLogin: boolean;
  } | null;
  locked: boolean;
  configured: boolean;
  busy: boolean;
}
export type AuthAction =
  "login" | "register" | "unlock" | "logout" | "refresh" | "cancel";
export type AuthResult = { snapshot: AuthSnapshot; error?: string };
