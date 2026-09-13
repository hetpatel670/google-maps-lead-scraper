/**
 * LeadFinder AI - Structured Logger Utility
 * Provides clean, leveled console logging with timestamps and module namespaces.
 */

(function (root) {
  const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
  };

  // Production default: INFO (debug disabled by default)
  let currentLogLevel = LOG_LEVELS.INFO;

  class Logger {
    constructor(namespace = 'LeadFinder') {
      this.namespace = namespace;
    }

    static setLevel(level) {
      if (typeof level === 'string' && LOG_LEVELS[level.toUpperCase()] !== undefined) {
        currentLogLevel = LOG_LEVELS[level.toUpperCase()];
      } else if (typeof level === 'number') {
        currentLogLevel = level;
      }
    }

    /**
     * Redact API keys, tokens, and sensitive personal credentials from log outputs
     */
    static _sanitize(item) {
      if (item === null || item === undefined) return item;
      if (typeof item === 'string') {
        return item
          .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
          .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED_KEY]')
          .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]')
          .replace(/(?:password|secret|apikey|api_key)\s*[:=]\s*["']?[^"'\s,]+["']?/gi, '$1: [REDACTED]');
      }
      if (item instanceof Error) {
        return `${item.name}: ${Logger._sanitize(item.message)}`;
      }
      if (typeof item === 'object') {
        try {
          const str = JSON.stringify(item, (key, value) => {
            if (/key|secret|password|token|auth/i.test(key) && typeof value === 'string') {
              return '[REDACTED]';
            }
            return value;
          });
          return JSON.parse(str);
        } catch {
          return '[Unserializable Object]';
        }
      }
      return item;
    }

    _formatMessage(levelStr, message) {
      const time = new Date().toISOString().substring(11, 19);
      const cleanMessage = Logger._sanitize(message);
      return `[${time}] [LeadFinder:${this.namespace}] [${levelStr}]: ${cleanMessage}`;
    }

    debug(message, ...args) {
      if (currentLogLevel <= LOG_LEVELS.DEBUG) {
        const sanitizedArgs = args.map(a => Logger._sanitize(a));
        console.debug(`%c${this._formatMessage('DEBUG', message)}`, 'color: #94a3b8', ...sanitizedArgs);
      }
    }

    info(message, ...args) {
      if (currentLogLevel <= LOG_LEVELS.INFO) {
        const sanitizedArgs = args.map(a => Logger._sanitize(a));
        console.info(`%c${this._formatMessage('INFO', message)}`, 'color: #0284c7; font-weight: 500', ...sanitizedArgs);
      }
    }

    warn(message, ...args) {
      if (currentLogLevel <= LOG_LEVELS.WARN) {
        const sanitizedArgs = args.map(a => Logger._sanitize(a));
        console.warn(`%c${this._formatMessage('WARN', message)}`, 'color: #eab308; font-weight: 600', ...sanitizedArgs);
      }
    }

    error(message, ...args) {
      if (currentLogLevel <= LOG_LEVELS.ERROR) {
        const sanitizedArgs = args.map(a => Logger._sanitize(a));
        console.error(`%c${this._formatMessage('ERROR', message)}`, 'color: #ef4444; font-weight: bold', ...sanitizedArgs);
      }
    }
  }

  const defaultLogger = new Logger('App');

  root.LeadFinder = root.LeadFinder || {};
  root.LeadFinder.Logger = Logger;
  root.LeadFinder.logger = defaultLogger;
  root.LeadFinder.LOG_LEVELS = LOG_LEVELS;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
