/**
 * Integration harness: builds the app, starts it against a throwaway SQLite
 * database and storage directory, runs the license-system suite, then cleans up.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const stamp = Date.now();
const dbPath = path.join(root, "data", `test-${stamp}.db`);
const storagePath = path.join(root, "storage", `test-${stamp}`);
const baseEnv = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`,
  STORAGE_DIR: storagePath,
  LICENSE_SECRET: "integration-license-secret-0123456789abcdef0123456789",
  ENCRYPTION_KEY: "integration-encryption-key-0123456789abcdef0123456789",
  ADMIN_SECRET: "integration-admin-secret-0123456789abcdef01234567",
  INITIAL_LICENSE_KEY: "",
  MAX_UPLOAD_MB: "64",
};

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function run(command, args, env, shell = false) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit", shell });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function cleanup() {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    } catch {
      /* ignore */
    }
  }
  try {
    fs.rmSync(storagePath, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

async function main() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  cleanup();

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  if (process.env.SKIP_BUILD !== "1") {
    console.log("\n[test] building production bundle…");
    const buildExit = await run("npm", ["run", "build"], baseEnv, process.platform === "win32");
    if (buildExit !== 0) {
      console.error("[test] build failed");
      process.exit(buildExit);
    }
  }

  console.log(`[test] starting server on ${baseUrl}`);
  const server = spawn(
    process.execPath,
    [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port), "-H", "127.0.0.1"],
    {
      cwd: root,
      env: { ...baseEnv, NEXT_PUBLIC_APP_URL: baseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));

  const ready = await waitForServer(`${baseUrl}/api/health`);
  if (!ready) {
    console.error("[test] server did not become ready");
    server.kill();
    cleanup();
    process.exit(1);
  }

  const testExit = await run(
    process.execPath,
    ["--test", "--test-concurrency=1", "tests/license-system.test.mjs"],
    {
      ...baseEnv,
      TEST_BASE_URL: baseUrl,
      TEST_DB_PATH: dbPath,
    },
  );

  server.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        server.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      resolve();
    }, 5000);
    server.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });

  cleanup();
  console.log(`[test] ${testExit === 0 ? "passed" : "failed"} (exit ${testExit})`);
  process.exit(testExit);
}

main().catch((err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});
