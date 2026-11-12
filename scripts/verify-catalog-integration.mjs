// Backwards-compatible entry point for the isolated packaged desktop suite.
import { spawn } from "node:child_process";
import path from "node:path";
const executable = process.argv[2] || process.env.BILLFLOW_APP_PATH;
if (executable && !path.isAbsolute(executable))
  throw new Error("Pass an absolute packaged BillFlow executable path.");
const child = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "test:desktop"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ...(executable ? { BILLFLOW_APP_PATH: executable } : {}),
    },
  },
);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
