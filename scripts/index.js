import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const DEFAULT_APPEND_META_OPTIONS = Object.freeze({
  api: "",
  url: "",
  projectKey: "",
  target: "./index.html",
});
const DEFAULT_REPLACE_CDN_OPTIONS = Object.freeze({
  api: "",
  projectKey: "",
  environment: "",
});

/**
 * Parse CLI arguments into an object map.
 * @param {string[]} argv
 * @returns {Record<string,string>}
 */
function parseCliArgs(argv) {
  return Object.fromEntries(
    argv.map((arg) => {
      const [key, val] = arg.replace(/^--/, "").split("=");
      return [key, val ?? ""];
    })
  );
}

/**
 * Build the argument list for append-meta.js.
 * @param {Record<string,string>} cliArgs
 * @returns {string[]}
 */
function buildAppendMetaArgs(cliArgs) {
  const api = cliArgs.append_meta_endpoint || DEFAULT_APPEND_META_OPTIONS.api;
  const url = cliArgs.append_meta_base44_url || DEFAULT_APPEND_META_OPTIONS.url;
  const projectKey =
    cliArgs.append_meta_project_key || DEFAULT_APPEND_META_OPTIONS.projectKey;
  const target =
    cliArgs.append_meta_target_file || DEFAULT_APPEND_META_OPTIONS.target;
  if (!api || !url || !projectKey || !target) {
    throw new Error("Missing append-meta configuration.");
  }
  return [`--api=${api}`, `--url=${url}`, `--project_key=${projectKey}`, `--target=${target}`];
}

/**
 * Build the argument list for replace-image-cdn-handler.js.
 * @param {Record<string,string>} cliArgs
 * @returns {string[]}
 */
function buildReplaceCdnArgs(cliArgs) {
  const api = cliArgs.replace_cdn_image_api || DEFAULT_REPLACE_CDN_OPTIONS.api;
  const projectKey =
    cliArgs.replace_cdn_image_project_key || DEFAULT_REPLACE_CDN_OPTIONS.projectKey;
  const environment =
    cliArgs.replace_cdn_image_environment || DEFAULT_REPLACE_CDN_OPTIONS.environment;
  if (!api || !projectKey || !environment) {
    throw new Error("Missing replace-image-cdn configuration.");
  }
  const args = [`--api=${api}`, `--project_key=${projectKey}`, `--environment=${environment}`];
  return args;
}

/**
 * Run a Node script in sequence.
 * @param {string} scriptPath
 * @param {string[]} args
 * @returns {Promise<void>}
 */
function runScript(scriptPath, args) {
  const absoluteScriptPath = path.join(__dirname, scriptPath);
  return new Promise((resolve, reject) => {
    const child = spawn("node", [absoluteScriptPath, ...args], {
      cwd: projectRoot,
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
}

/**
 * Execute all automation scripts sequentially.
 * @returns {Promise<void>}
 */
async function executeAutomation() {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const appendMetaArgs = buildAppendMetaArgs(cliArgs);
  const replaceCdnArgs = buildReplaceCdnArgs(cliArgs);
  const tasks = [
    { path: "./replace-login-handler.js", args: [] },
    { path: "./replace-auth-handler.js", args: [] },
    { path: "./replace-app-handler.js", args: [] },
    { path: "./append-meta.js", args: appendMetaArgs },
    { path: "./replace-image-cdn-handler.js", args: replaceCdnArgs },
  ];
  for (const task of tasks) {
    console.log(`➡️  Running ${task.path}`);
    await runScript(task.path, task.args);
  }
}

executeAutomation()
  .then(() => console.log("✅ All scripts completed successfully."))
  .catch((error) => {
    console.error("❌ Automation failed:", error.message);
    process.exit(1);
  });

