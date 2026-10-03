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
  tokens: Tokens;
}
export interface AuthSnapshot {
  user: {
    id: string;
    name: string;
    email?: string;
    username?: string;
    expiresAt: number;
    needsLogin: boolean;
  } | null;
  locked: boolean;
  configured: boolean;
  busy: boolean;
}
export type AuthAction = "login" | "unlock" | "logout" | "refresh" | "cancel";
export type AuthResult = { snapshot: AuthSnapshot; error?: string };
