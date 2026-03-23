import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { initLogger, debug, info, warn, error, getLogFilePath, logFromRenderer, isLogLevel } from './logger';

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stex-logger-test-'));
}

function readLog(logDir: string): string {
  return fs.readFileSync(path.join(logDir, 'stex.log'), 'utf-8');
}

describe('logger', () => {
  let logDir: string;

  beforeEach(() => {
    logDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(logDir, { recursive: true, force: true });
  });

  describe('initLogger', () => {
    it('creates the log directory if it does not exist', () => {
      const nested = path.join(logDir, 'subdir', 'logs');
      initLogger({ logDir: nested });
      info('test');
      expect(fs.existsSync(nested)).toBe(true);
      fs.rmSync(path.join(logDir, 'subdir'), { recursive: true, force: true });
    });

    it('switches output to new directory on re-initialization', () => {
      initLogger({ logDir });
      info('first');

      const newDir = createTmpDir();
      initLogger({ logDir: newDir });
      info('second');

      const firstLog = readLog(logDir);
      const secondLog = readLog(newDir);
      expect(firstLog).toContain('first');
      expect(firstLog).not.toContain('second');
      expect(secondLog).toContain('second');
      fs.rmSync(newDir, { recursive: true, force: true });
    });

    it('operates in console-only mode if directory creation fails', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      initLogger({ logDir: path.join(logDir, '\0invalid') });
      info('console only');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('log levels', () => {
    it('filters out messages below the configured level', () => {
      initLogger({ logDir, level: 'warn' });
      debug('should not appear');
      info('should not appear');
      warn('should appear');
      error('also appears');

      const content = readLog(logDir);
      expect(content).not.toContain('should not appear');
      expect(content).toContain('should appear');
      expect(content).toContain('also appears');
    });

    it('defaults to info level', () => {
      initLogger({ logDir });
      debug('hidden');
      info('visible');

      const content = readLog(logDir);
      expect(content).not.toContain('hidden');
      expect(content).toContain('visible');
    });

    it('shows all messages at debug level', () => {
      initLogger({ logDir, level: 'debug' });
      debug('debug msg');
      info('info msg');
      warn('warn msg');
      error('error msg');

      const content = readLog(logDir);
      expect(content).toContain('debug msg');
      expect(content).toContain('info msg');
      expect(content).toContain('warn msg');
      expect(content).toContain('error msg');
    });
  });

  describe('format', () => {
    it('includes timestamp, level, source, and message', () => {
      initLogger({ logDir, level: 'debug' });
      info('hello world');

      const content = readLog(logDir);
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[INFO\] \[main\] hello world/);
    });

    it('supports format string interpolation (%s, %d)', () => {
      initLogger({ logDir });
      info('connected to %s on port %d', 'localhost', 8080);

      const content = readLog(logDir);
      expect(content).toContain('connected to localhost on port 8080');
    });

    it('appends extra args when no format placeholders match', () => {
      initLogger({ logDir });
      info('event', 'extra1', 42);

      const content = readLog(logDir);
      expect(content).toContain('event extra1 42');
    });

    it('includes [main] source tag for main-process log calls', () => {
      initLogger({ logDir });
      warn('test warning');

      const content = readLog(logDir);
      expect(content).toContain('[WARN] [main] test warning');
    });
  });

  describe('console mirroring', () => {
    it('writes debug/info to console.log', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      initLogger({ logDir, level: 'debug' });
      debug('test debug');
      info('test info');

      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });

    it('writes warn/error to console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      initLogger({ logDir });
      warn('test warn');
      error('test error');

      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });
  });

  describe('getLogFilePath', () => {
    it('returns the log file path after successful initialization', () => {
      initLogger({ logDir });
      expect(getLogFilePath()).toBe(path.join(logDir, 'stex.log'));
    });

    it('returns null in console-only mode (failed init)', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      initLogger({ logDir: path.join(logDir, '\0invalid') });
      expect(getLogFilePath()).toBeNull();
      spy.mockRestore();
    });
  });

  describe('file rotation', () => {
    it('rotates log file when it exceeds max size', () => {
      const logFile = path.join(logDir, 'stex.log');
      const bigContent = 'x'.repeat(6 * 1024 * 1024);
      fs.writeFileSync(logFile, bigContent);

      initLogger({ logDir });
      info('after rotation');

      const rotated = path.join(logDir, 'stex.log.1');
      expect(fs.existsSync(rotated)).toBe(true);
      expect(fs.readFileSync(rotated, 'utf-8')).toBe(bigContent);

      const newContent = readLog(logDir);
      expect(newContent).toContain('after rotation');
      expect(newContent.length).toBeLessThan(bigContent.length);
    });

    it('does not rotate when file is under max size', () => {
      const logFile = path.join(logDir, 'stex.log');
      fs.writeFileSync(logFile, 'small log');

      initLogger({ logDir });
      info('appended');

      const rotated = path.join(logDir, 'stex.log.1');
      expect(fs.existsSync(rotated)).toBe(false);

      const content = readLog(logDir);
      expect(content).toContain('small log');
      expect(content).toContain('appended');
    });
  });

  describe('isLogLevel', () => {
    it('returns true for valid log levels', () => {
      expect(isLogLevel('debug')).toBe(true);
      expect(isLogLevel('info')).toBe(true);
      expect(isLogLevel('warn')).toBe(true);
      expect(isLogLevel('error')).toBe(true);
    });

    it('returns false for invalid strings', () => {
      expect(isLogLevel('critical')).toBe(false);
      expect(isLogLevel('WARN')).toBe(false);
      expect(isLogLevel('')).toBe(false);
    });

    it('returns false for non-strings', () => {
      expect(isLogLevel(42)).toBe(false);
      expect(isLogLevel(null)).toBe(false);
      expect(isLogLevel(undefined)).toBe(false);
    });
  });

  describe('logFromRenderer', () => {
    it('writes with [renderer] source tag', () => {
      initLogger({ logDir });
      logFromRenderer('error', 'renderer crash');

      const content = readLog(logDir);
      expect(content).toContain('[ERROR] [renderer] renderer crash');
    });

    it('writes with the correct level', () => {
      initLogger({ logDir });
      logFromRenderer('warn', 'renderer warning');

      const content = readLog(logDir);
      expect(content).toContain('[WARN] [renderer] renderer warning');
    });

    it('respects the configured log level', () => {
      initLogger({ logDir, level: 'warn' });
      logFromRenderer('info', 'should be filtered');
      logFromRenderer('warn', 'should appear');

      const content = readLog(logDir);
      expect(content).not.toContain('should be filtered');
      expect(content).toContain('should appear');
    });

    it('sanitizes newlines in renderer messages', () => {
      initLogger({ logDir });
      logFromRenderer('error', 'line1\nfake\r\ninjection');

      const content = readLog(logDir);
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(content).toContain('[ERROR] [renderer] line1 fake injection');
    });
  });
});
