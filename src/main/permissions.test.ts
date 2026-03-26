import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockSetPermissionCheckHandler, mockSetPermissionRequestHandler } = vi.hoisted(() => {
  const mockSetPermissionCheckHandler = vi.fn();
  const mockSetPermissionRequestHandler = vi.fn();
  return { mockSetPermissionCheckHandler, mockSetPermissionRequestHandler };
});

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      setPermissionCheckHandler: (...args: unknown[]) => mockSetPermissionCheckHandler(...args),
      setPermissionRequestHandler: (...args: unknown[]) => mockSetPermissionRequestHandler(...args),
    },
  },
}));

vi.mock('./logger');

import { initPermissions } from './permissions';

describe('initPermissions', () => {
  beforeEach(() => {
    mockSetPermissionCheckHandler.mockClear();
    mockSetPermissionRequestHandler.mockClear();
  });

  it('sets a permission check handler on the default session', () => {
    initPermissions();
    expect(mockSetPermissionCheckHandler).toHaveBeenCalledOnce();
    expect(mockSetPermissionCheckHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it('sets a permission request handler on the default session', () => {
    initPermissions();
    expect(mockSetPermissionRequestHandler).toHaveBeenCalledOnce();
    expect(mockSetPermissionRequestHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  describe('permission check handler', () => {
    it('grants media permission checks', () => {
      initPermissions();
      const handler = mockSetPermissionCheckHandler.mock.calls[0][0] as (
        wc: unknown, perm: string,
      ) => boolean;
      expect(handler(null, 'media')).toBe(true);
    });

    it('grants clipboard-sanitized-write permission checks', () => {
      initPermissions();
      const handler = mockSetPermissionCheckHandler.mock.calls[0][0] as (
        wc: unknown, perm: string,
      ) => boolean;
      expect(handler(null, 'clipboard-sanitized-write')).toBe(true);
    });

    it('grants clipboard-read permission checks', () => {
      initPermissions();
      const handler = mockSetPermissionCheckHandler.mock.calls[0][0] as (
        wc: unknown, perm: string,
      ) => boolean;
      expect(handler(null, 'clipboard-read')).toBe(true);
    });

    it('denies non-allowlisted permission checks', () => {
      initPermissions();
      const handler = mockSetPermissionCheckHandler.mock.calls[0][0] as (
        wc: unknown, perm: string,
      ) => boolean;
      expect(handler(null, 'geolocation')).toBe(false);
    });
  });

  describe('permission request handler', () => {
    it('grants media permission requests', () => {
      initPermissions();
      const handler = mockSetPermissionRequestHandler.mock.calls[0][0] as (
        wc: unknown, perm: string, cb: (granted: boolean) => void,
      ) => void;
      const callback = vi.fn();
      handler(null, 'media', callback);
      expect(callback).toHaveBeenCalledWith(true);
    });

    it('denies non-media permission requests', () => {
      initPermissions();
      const handler = mockSetPermissionRequestHandler.mock.calls[0][0] as (
        wc: unknown, perm: string, cb: (granted: boolean) => void,
      ) => void;
      const callback = vi.fn();
      handler(null, 'geolocation', callback);
      expect(callback).toHaveBeenCalledWith(false);
    });
  });
});
