import assert from "node:assert/strict";
import { test } from "node:test";
import { registerAuthIpc, getAuthenticatedUserId } from "@/lib/auth/service";
import { getUserProfile } from "@/services/user-profile";
import { calls, handlers, frame, sender } from "./electron-auth-mock";
import { directory } from "./electron-auth-mock";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

test("Verified login/refresh synchronize SQLite profiles; logout clears identity while retaining public cache", async () => {
  registerAuthIpc();
  const event = { sender, senderFrame: frame };
  const command = async (action: string) =>
    handlers.get("auth:command")!(event, action) as Promise<
      import("@/lib/auth/types").AuthResult
    >;
  const filename = path.join(directory, "sso.v1.enc");
  const oldVault = "TEST-ONLY:inaccessible-old-vault";
  await writeFile(filename, oldVault);
  calls.available = false;
  const deniedStorage = await command("login");
  assert(deniedStorage.error, "Saving still requires secure OS encryption");
  assert.equal(calls.decrypt, 0, "Fresh sign-in never decrypts the old vault");
  assert.equal(
    await readFile(filename, "utf8"),
    oldVault,
    "Failed storage preserves old data",
  );
  calls.available = true;
  const loggedIn = await command("login");
  assert(!loggedIn.error);
  assert.equal(calls.decrypt, 0);
  assert.equal(loggedIn.snapshot.locked, false);
  assert.equal(getAuthenticatedUserId(), "verified-subject");
  const before = getUserProfile("verified-subject")!;
  assert.equal(before.email, "before@example.test");
  const refreshed = await command("refresh");
  assert(!refreshed.error);
  const after = getUserProfile("verified-subject")!;
  assert.equal(after.name, "After");
  assert.equal(after.email, "after@example.test");
  assert.equal(after.username, "changed");
  assert.equal(after.emailVerified, true);
  assert.equal(after.createdAt, before.createdAt);
  assert(!JSON.stringify(after).includes("PRIVATE-"));
  assert(!JSON.stringify(calls.snapshots).includes("PRIVATE-"));
  assert.equal(getUserProfile("unverified-renderer-id"), null);
  await command("logout");
  assert.equal(getAuthenticatedUserId(), null);
  assert.equal(getUserProfile("verified-subject")?.name, "After");
});
