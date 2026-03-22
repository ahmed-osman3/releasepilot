import fs from "node:fs";
import path from "node:path";

const MAX_LOG_SIZE = 1024 * 1024; // 1 MB
const LOG_FILE_NAME = "itsyconnect.log";

let logPath = "";

export function getLogPath(): string {
  return logPath;
}

export function getLogDir(): string {
  return path.dirname(logPath);
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function rotateIfNeeded(): void {
  try {
    const stats = fs.statSync(logPath);
    if (stats.size >= MAX_LOG_SIZE) {
      const backup = logPath + ".1";
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      fs.renameSync(logPath, backup);
    }
  } catch {
    // File doesn't exist yet – nothing to rotate
  }
}

function writeToFile(level: string, args: unknown[]): void {
  const message = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
    .join(" ");
  const line = `[${timestamp()}] [${level}] ${message}\n`;

  try {
    rotateIfNeeded();
    fs.appendFileSync(logPath, line);
  } catch {
    // Silently ignore write errors – don't break the app
  }
}

export function initLogger(logDir?: string): void {
  if (!logDir) logDir = require("electron").app.getPath("logs");
  fs.mkdirSync(logDir!, { recursive: true });
  logPath = path.join(logDir!, LOG_FILE_NAME);

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    originalLog(...args);
    writeToFile("info", args);
  };

  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    writeToFile("warn", args);
  };

  console.error = (...args: unknown[]) => {
    originalError(...args);
    writeToFile("error", args);
  };

  console.log(`--- App starting (log: ${logPath}) ---`);
}
