import fs from "node:fs";
import path from "node:path";
const packages = [
  "drizzle-orm",
  "zod",
  "pdf-lib",
  "@pdf-lib/standard-fonts",
  "@pdf-lib/upng",
  "pako",
  "tslib",
  "better-sqlite3",
];
const notices = packages.map((name) => {
  const directory = path.join("node_modules", name);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf8"),
  );
  const files = fs
    .readdirSync(directory)
    .filter((file) =>
      /^licen[cs]e(?:\.|$)|copyrightnotice|^notice(?:\.|$)/i.test(file),
    );
  if (!files.length && name === "drizzle-orm")
    return `${name} ${pkg.version}\n${fs.readFileSync("build/licenses/drizzle-orm.LICENSE.txt", "utf8")}`;
  if (!files.length)
    throw new Error(`Missing license for bundled package ${name}`);
  return `${name} ${pkg.version}\n${files.map((file) => fs.readFileSync(path.join(directory, file), "utf8")).join("\n")}`;
});
fs.writeFileSync(
  "build/THIRD_PARTY_NOTICES.txt",
  notices.join("\n\n--------------------------------------------------\n\n"),
);
