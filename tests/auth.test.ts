import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { createAdaptorServer } from "@hono/node-server";
import { createAuthRoutes } from "@/routes/auth";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { trustedUrl, tokenSet } from "../lib/auth/model";

test("Auth configuration rejects insecure URLs; token refresh retains rotated credentials correctly", () => {
  assert.throws(() => trustedUrl("http://example.com"));
  assert.throws(() => trustedUrl("https://secret:password@example.com"));
  assert.equal(trustedUrl("http://127.0.0.1:1234", true).protocol, "http:");
  assert.throws(() =>
    tokenSet(
      { access_token: "a", expires_in: -1, token_type: "Bearer" },
      "provider",
    ),
  );
  const previous = tokenSet(
    {
      access_token: "a",
      refresh_token: "r1",
      expires_in: 60,
      token_type: "Bearer",
    },
    "provider",
  );
  assert.equal(
    tokenSet(
      { access_token: "b", expires_in: 60, token_type: "Bearer" },
      "provider",
      previous,
    ).refreshToken,
    "r1",
  );
  assert.equal(
    tokenSet(
      {
        access_token: "b",
        refresh_token: "r2",
        expires_in: 60,
        token_type: "Bearer",
      },
      "provider",
      previous,
    ).refreshToken,
    "r2",
  );
});

test("Gorth OIDC: PKCE, state, signature, issuer, audience, nonce, expiry, refresh and cancellation", async () => {
  const keys = await generateKeyPair("RS256");
  const wrongKeys = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: "test",
    alg: "RS256",
  };
  let issuer = "";
  let current: URL;
  let mode = "valid";
  const revoked: string[] = [];
  const probe = createServer();
  await new Promise<void>((r) => probe.listen(0, "127.0.0.1", r));
  const callbackPort = (probe.address() as { port: number }).port;
  await new Promise<void>((r) => probe.close(() => r()));
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/auth/.well-known/openid-configuration") {
      res.end(
        JSON.stringify({
          issuer,
          authorization_endpoint: issuer + "/authorize",
          token_endpoint: issuer + "/token",
          jwks_uri: issuer + "/jwks",
          userinfo_endpoint: issuer + "/userinfo",
          revocation_endpoint: issuer + "/revoke",
        }),
      );
      return;
    }
    if (req.url === "/auth/jwks") {
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (req.url === "/auth/userinfo") {
      assert.equal(req.headers.authorization, "Bearer private-access");
      res.end(
        JSON.stringify({
          sub: mode === "userinfo" ? "wrong-user" : "user-123",
          name: "Gorth Player",
          email: "player@example.test",
          preferred_username: "player",
        }),
      );
      return;
    }
    if (req.url === "/auth/revoke") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const form = new URLSearchParams(body);
      assert.equal(form.get("client_id"), "gorth-browser");
      assert(
        ["private-access", "private-refresh"].includes(form.get("token")!),
      );
      revoked.push(form.get("token_type_hint")!);
      res.writeHead(200).end();
      return;
    }
    if (req.url === "/auth/token") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const form = new URLSearchParams(body);
      if (form.get("grant_type") === "authorization_code") {
        assert.equal(form.get("code"), "test-code");
        assert.equal(
          createHash("sha256")
            .update(form.get("code_verifier")!)
            .digest("base64url"),
          current.searchParams.get("code_challenge"),
        );
      }
      const jwt = await new SignJWT({
        at_hash:
          mode === "at_hash"
            ? "invalid"
            : createHash("sha256")
                .update("private-access")
                .digest()
                .subarray(0, 16)
                .toString("base64url"),
        c_hash:
          mode === "c_hash"
            ? "invalid"
            : createHash("sha256")
                .update("test-code")
                .digest()
                .subarray(0, 16)
                .toString("base64url"),
        name: "Gorth Player",
        nonce: mode === "nonce" ? "wrong" : current.searchParams.get("nonce"),
      })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer(mode === "issuer" ? "https://wrong.test" : issuer)
        .setAudience(mode === "audience" ? "wrong-client" : "gorth-browser")
        .setSubject(mode === "subject" ? "other-user" : "user-123")
        .setIssuedAt()
        .setExpirationTime(
          mode === "expired" ? Math.floor(Date.now() / 1000) - 60 : "5m",
        )
        .sign(mode === "signature" ? wrongKeys.privateKey : keys.privateKey);
      res.end(
        JSON.stringify({
          access_token: "private-access",
          refresh_token: "private-refresh",
          expires_in: 300,
          token_type: "Bearer",
          id_token: jwt,
        }),
      );
      return;
    }
    res.writeHead(404).end("{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin =
    "http://127.0.0.1:" + (server.address() as { port: number }).port;
  issuer = origin + "/auth";
  process.env.VITE_SSO_CLIENT_URL = origin;
  process.env.VITE_SSO_SERVER_URL = origin;
  process.env.VITE_SSO_OAUTH_CLIENT_ID = "gorth-browser";
  process.env.VITE_APP_URL = "http://127.0.0.1:" + callbackPort;
  // Metadata carries issuer-qualified endpoint paths, matching Better Auth.
  const { loginGorth, refreshGorth, revokeGorth } =
    await import("../lib/auth/gorth");
  const callbackServer = createAdaptorServer({
    fetch: new Hono().route("/auth", createAuthRoutes()).fetch,
  });
  await new Promise<void>((resolve, reject) => {
    callbackServer.once("error", reject);
    callbackServer.listen(callbackPort, "127.0.0.1", resolve);
  });
  const open = async (value: string) => {
    current = new URL(value);
    assert.equal(current.searchParams.get("code_challenge_method"), "S256");
    assert.equal(current.searchParams.get("client_id"), "gorth-browser");
    assert.equal(current.searchParams.get("redirect"), "gorth://auth");
    const callback = new URL(current.searchParams.get("redirect_uri")!);
    callback.searchParams.set("code", "test-code");
    callback.searchParams.set("state", "invalid");
    assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.set("state", current.searchParams.get("state")!);
    assert.equal((await fetch(callback)).status, 200);
  };
  try {
    const session = await loginGorth(open, new AbortController().signal);
    assert.equal(
      current.searchParams.has("prompt"),
      false,
      "Normal login must not force a fresh SSO login or loop an existing session",
    );
    assert.equal(session.id, "user-123");
    assert.equal(session.email, "player@example.test");
    assert.equal(session.username, "player");
    const registered = await loginGorth(
      async (value, receiveCallback) => {
        current = new URL(value);
        assert.equal(current.searchParams.get("prompt"), "create");
        assert.equal(current.searchParams.get("code_challenge_method"), "S256");
        const callback = new URL(current.searchParams.get("redirect_uri")!);
        callback.searchParams.set("code", "test-code");
        callback.searchParams.set("state", "wrong-state");
        assert.equal(receiveCallback(callback.href), false);
        callback.searchParams.set("state", current.searchParams.get("state")!);
        assert.equal(receiveCallback(callback.href), true);
        assert.equal(
          receiveCallback(callback.href),
          false,
          "Embedded callback is single-use",
        );
      },
      new AbortController().signal,
      "register",
    );
    assert.equal(registered.id, session.id);
    await revokeGorth(session.tokens, new AbortController().signal);
    assert.deepEqual(revoked.sort(), ["access_token", "refresh_token"]);
    assert.equal(
      (await refreshGorth(session, new AbortController().signal)).id,
      session.id,
    );
    for (mode of [
      "nonce",
      "issuer",
      "audience",
      "expired",
      "signature",
      "at_hash",
      "c_hash",
      "userinfo",
    ])
      await assert.rejects(
        loginGorth(open, new AbortController().signal),
        Error,
        mode,
      );
    mode = "subject";
    await assert.rejects(refreshGorth(session, new AbortController().signal));
    mode = "valid";
    await assert.rejects(
      loginGorth(async (value) => {
        const url = new URL(value);
        const callback = new URL(url.searchParams.get("redirect_uri")!);
        callback.searchParams.set("state", url.searchParams.get("state")!);
        callback.searchParams.set("code", "test-code");
        callback.searchParams.set("iss", "https://wrong.example");
        assert.equal((await fetch(callback)).status, 400);
      }, new AbortController().signal),
      /issuer mismatch/,
    );
    const controller = new AbortController();
    await assert.rejects(
      loginGorth(async () => {
        controller.abort();
      }, controller.signal),
    );
  } finally {
    callbackServer.close();
    if ("closeAllConnections" in callbackServer)
      callbackServer.closeAllConnections();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
