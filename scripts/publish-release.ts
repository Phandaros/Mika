import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

type BumpType = "patch" | "minor" | "major";

interface DesktopPackageJson {
  version: string;
  [key: string]: unknown;
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopPackagePath = path.join(rootDir, "apps", "desktop", "package.json");
const desktopDistDir = path.join(rootDir, "apps", "desktop", "dist");
const releaseChannelDir = path.join(rootDir, "apps", "server", "release-channel");

function parseBumpType(value: string | undefined): BumpType {
  if (value === "patch" || value === "minor" || value === "major") {
    return value;
  }

  throw new Error("Uso: pnpm release patch|minor|major");
}

function bumpVersion(version: string, bumpType: BumpType): string {
  const parts = version.split(".").map((part) => Number(part));

  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Versao invalida em apps/desktop/package.json: ${version}`);
  }

  const [major, minor, patch] = parts;

  if (bumpType === "major") {
    return `${major + 1}.0.0`;
  }

  if (bumpType === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

async function ensureCleanWorkingTree(): Promise<void> {
  const result = await execa("git", ["status", "--porcelain"], { cwd: rootDir });

  if (result.stdout.trim()) {
    throw new Error("Working tree precisa estar limpo antes de publicar uma release.");
  }
}

async function readDesktopPackage(): Promise<DesktopPackageJson> {
  return JSON.parse(await fs.readFile(desktopPackagePath, "utf8")) as DesktopPackageJson;
}

async function writeDesktopPackage(packageJson: DesktopPackageJson): Promise<void> {
  await fs.writeFile(desktopPackagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk: Buffer) => {
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });
}

async function promptReleaseNotes(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const lines: string[] = [];
  console.log("Digite as release notes. Envie uma linha vazia para finalizar.");

  try {
    while (true) {
      const line = await rl.question("> ");

      if (!line.trim()) {
        break;
      }

      lines.push(line);
    }
  } finally {
    rl.close();
  }

  const releaseNotes = lines.join("\n").trim();

  if (!releaseNotes) {
    throw new Error("Release notes sao obrigatorias.");
  }

  return releaseNotes;
}

async function removeOldInstallers(currentFileName: string): Promise<void> {
  const entries = await fs.readdir(releaseChannelDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".exe") && entry.name !== currentFileName)
      .map((entry) => fs.unlink(path.join(releaseChannelDir, entry.name)))
  );
}

async function main(): Promise<void> {
  const bumpType = parseBumpType(process.argv[2]);
  await ensureCleanWorkingTree();

  const packageJson = await readDesktopPackage();
  const nextVersion = bumpVersion(packageJson.version, bumpType);
  packageJson.version = nextVersion;
  await writeDesktopPackage(packageJson);

  await execa("pnpm", ["--filter", "client", "build"], { cwd: rootDir, stdio: "inherit" });
  await execa("pnpm", ["--filter", "desktop", "build"], { cwd: rootDir, stdio: "inherit" });

  const installerFileName = `MikaSetup-${nextVersion}.exe`;
  const installerPath = path.join(desktopDistDir, installerFileName);
  const sha256 = await sha256File(installerPath);
  const releaseNotes = await promptReleaseNotes();

  await fs.mkdir(releaseChannelDir, { recursive: true });
  await fs.copyFile(installerPath, path.join(releaseChannelDir, installerFileName));
  await removeOldInstallers(installerFileName);
  await fs.writeFile(
    path.join(releaseChannelDir, "latest.json"),
    `${JSON.stringify(
      {
        version: nextVersion,
        releaseDate: new Date().toISOString(),
        releaseNotes,
        fileName: installerFileName,
        sha256
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await execa("git", ["add", "apps/desktop/package.json"], { cwd: rootDir, stdio: "inherit" });
  await execa("git", ["commit", "-m", `chore: release v${nextVersion}`], { cwd: rootDir, stdio: "inherit" });
  await execa("git", ["tag", `v${nextVersion}`], { cwd: rootDir, stdio: "inherit" });

  console.log("");
  console.log(`Release v${nextVersion} publicada em apps/server/release-channel`);
  console.log(`Instalador: ${path.join(releaseChannelDir, installerFileName)}`);
  console.log(`SHA-256: ${sha256}`);
  console.log("Push sugerido: git push && git push --tags");
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Falha ao publicar release.");
  }

  process.exit(1);
});
