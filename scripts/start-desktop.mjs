import { spawn } from "node:child_process";
import fs from "node:fs";
import electron from "electron";
if (!fs.existsSync(new URL("../out/index.html", import.meta.url)))
  throw new Error("Run npm run build before npm start.");
const child = spawn(electron, ["."], {
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: undefined,
    TEST_PROD_BUILD: "1",
  },
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
