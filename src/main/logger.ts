import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[currentLevel]) return;

  const formatted = format(message, ...args);
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${formatted}\n`;

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

export function debug(message: string, ...args: unknown[]): void {
  log('debug', message, ...args);
}

export function info(message: string, ...args: unknown[]): void {
  log('info', message, ...args);
}

export function warn(message: string, ...args: unknown[]): void {
  log('warn', message, ...args);
}

export function error(message: string, ...args: unknown[]): void {
  log('error', message, ...args);
}
