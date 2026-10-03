import { app, safeStorage } from "electron";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import type { AuthSession } from "./types";

const sessionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    email: z.string().optional(),
    username: z.string().optional(),
    tokens: z.object({
      accessToken: z.string().min(1),
      refreshToken: z.string().min(1).optional(),
      expiresAt: z.number().finite(),
      binding: z.string().min(1),
    }),
  })
  .nullable();
const vaultSchema = z.object({ version: z.literal(1), session: sessionSchema });
const file = () => path.join(app.getPath("userData"), "sso.v1.enc");
export const vaultExists = () => existsSync(file());
function encryption() {
  if (
    !safeStorage.isEncryptionAvailable() ||
    (process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text")
  )
    throw new Error(
      "Unlock your system keychain to securely store your session.",
    );
}
export async function readVault(): Promise<AuthSession | null> {
  let bytes: Buffer;
  try {
    bytes = await readFile(file());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  encryption();
  const value: unknown = JSON.parse(safeStorage.decryptString(bytes));
  const result = vaultSchema.safeParse(value);
  if (!result.success)
    throw new Error("Invalid saved session. Existing data has been preserved.");
  return result.data.session;
}
export async function writeVault(session: AuthSession | null) {
  encryption();
  const value = vaultSchema.parse({ version: 1, session });
  await mkdir(app.getPath("userData"), { recursive: true });
  const temporary = file() + "." + randomUUID() + ".tmp";
  await writeFile(temporary, safeStorage.encryptString(JSON.stringify(value)), {
    mode: 0o600,
  });
  await rename(temporary, file());
}
