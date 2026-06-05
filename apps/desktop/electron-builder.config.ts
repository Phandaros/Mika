import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Configuration } from "electron-builder";

const iconPath = "assets/icon.ico";
const __dirname = dirname(fileURLToPath(import.meta.url));
const winIcon = existsSync(resolve(__dirname, iconPath)) ? iconPath : undefined;

const config: Configuration = {
  appId: "com.mkengenharia.mika",
  productName: "Mika",
  artifactName: "MikaSetup-${version}.${ext}",
  directories: {
    output: "dist"
  },
  files: ["dist/**", "package.json"],
  extraResources: [
    {
      from: "../client/dist",
      to: "client"
    }
  ],
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    signAndEditExecutable: false,
    forceCodeSigning: false,
    ...(winIcon ? { icon: winIcon } : {})
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    ...(winIcon ? { installerIcon: winIcon, uninstallerIcon: winIcon } : {}),
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Mika"
  },
  publish: null
};

export default config;
