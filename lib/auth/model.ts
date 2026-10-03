import type { Tokens } from "./types";
import { parseHttpUrl } from "@/lib/utils/schema";
export function trustedUrl(value: string, allowLoopback = false) {
  const url = parseHttpUrl(value);
  const local =
    allowLoopback && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("Auth URL cần HTTPS (HTTP chỉ cho localhost).");
  return url;
}
export function tokenSet(
  data: Record<string, unknown>,
  binding: string,
  previous?: Tokens,
): Tokens {
  if (
    typeof data.access_token !== "string" ||
    !data.access_token ||
    typeof data.expires_in !== "number" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 ||
    String(data.token_type).toLowerCase() !== "bearer"
  )
    throw new Error("Phản hồi token không hợp lệ.");
  return {
    accessToken: data.access_token,
    refreshToken:
      typeof data.refresh_token === "string"
        ? data.refresh_token
        : previous?.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    binding,
  };
}
