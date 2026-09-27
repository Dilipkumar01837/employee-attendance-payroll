// Dependency-free syntax check across every backend source file.
// `node --check` parses the file without executing it, so this needs no
// database connection and no test runner.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOTS = ["src", "scripts", "test"];
const ROOT = path.resolve(__dirname, "..");

const collect = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      collect(full, files);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(full);
    }
  }

  return files;
};

const targets = ROOTS.filter((root) =>
  fs.existsSync(path.join(ROOT, root))
).flatMap((root) => collect(path.join(ROOT, root)));

const failures = [];

for (const file of targets) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    failures.push({ file, message: String(error.stderr || error.message) });
  }
}

if (failures.length > 0) {
  for (const { file, message } of failures) {
    console.error(`FAIL ${path.relative(ROOT, file)}`);
    console.error(message);
  }

  console.error(`\n${failures.length} of ${targets.length} files failed to parse.`);
  process.exit(1);
}

console.log(`${targets.length} files parsed successfully.`);
