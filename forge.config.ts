import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const appIcon =
  process.platform === "darwin"
    ? "assets/favicon.icns"
    : process.platform === "win32"
      ? "assets/favicon.ico"
      : "assets/favicon.png";

const config: ForgeConfig = {
  hooks: {
    preStart: async () => {
      // Set before Electron is spawned; AppKit logging initializes before main.ts.
      if (process.platform === "darwin") {
        process.env.OS_ACTIVITY_MODE ??= "disable";
      }
    },
  },
  packagerConfig: {
    appBundleId: "com.gorth.browser",
    appCategoryType: "public.app-category.productivity",
    asar: true,
    executableName: "Gorth Browser",
    icon: appIcon,
    ignore: (filePath) => {
      if (!filePath) {
        return false;
      }

      return !(
        filePath.startsWith("/.vite") ||
        filePath === "/assets" ||
        filePath.startsWith("/assets/") ||
        filePath === "/node_modules" ||
        filePath.startsWith("/node_modules/")
      );
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "app/main.ts",
          config: "rollup.config.ts",
          target: "main",
        },
        {
          entry: "app/preload.ts",
          config: "rolldown.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.config.ts",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
