import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export const LOG_LEVELS: ReadonlySet<string> = new Set<LogLevel>(['debug', 'info', 'warn', 'error']);

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && LOG_LEVELS.has(value);
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

let logFile: string | null = null;
let currentLevel: LogLevel = 'info';

function rotateIfNeeded(file: string): void {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(file);
  } catch {
    return; // File doesn't exist yet — nothing to rotate
  }

  if (stats.size > MAX_LOG_SIZE_BYTES) {
    try {
      fs.rmSync(file + '.1', { force: true });
      fs.renameSync(file, file + '.1');
    } catch {
      // Rotation failed — continue appending to the existing file
    }
  }
}

export function initLogger(opts: { logDir: string; level?: LogLevel }): void {
  currentLevel = opts.level ?? 'info';
  logFile = null;

  try {
    fs.mkdirSync(opts.logDir, { recursive: true });
    const file = path.join(opts.logDir, 'stex.log');
    rotateIfNeeded(file);
    logFile = file;
  } catch {
    // Console-only mode — logFile stays null
  }
}

function writeLog(level: LogLevel, source: string, formatted: string): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;

  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${source}] ${formatted}\n`;

  if (logFile) {
    try {
      fs.appendFileSync(logFile, line);
    } catch {
      // Ignore write errors — don't crash the app over logging
    }
  }

  if (level === 'debug' || level === 'info') {
    console.log(line.trimEnd());
  } else {
    console.error(line.trimEnd());
  }
}

export function getLogFilePath(): string | null {
  return logFile;
}

export function debug(message: string, ...args: unknown[]): void {
  writeLog('debug', 'main', format(message, ...args));
}

export function info(message: string, ...args: unknown[]): void {
  writeLog('info', 'main', format(message, ...args));
}

export function warn(message: string, ...args: unknown[]): void {
  writeLog('warn', 'main', format(message, ...args));
}

export function error(message: string, ...args: unknown[]): void {
  writeLog('error', 'main', format(message, ...args));
}

export function logFromRenderer(level: LogLevel, message: string): void {
  const sanitized = message.replace(/[\r\n]+/g, ' ');
  writeLog(level, 'renderer', sanitized);
}
