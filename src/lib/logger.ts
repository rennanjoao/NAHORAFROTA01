/**
 * Production-safe logging utility
 * Logs are only output in development mode to prevent information leakage
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * Debug log - only visible in development
   */
  debug: (...args: unknown[]): void => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Info log - only visible in development
   */
  info: (...args: unknown[]): void => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Warning log - only visible in development
   */
  warn: (...args: unknown[]): void => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Error log - only visible in development
   * In production, errors should be sent to a proper monitoring service
   */
  error: (...args: unknown[]): void => {
    if (isDev) {
      console.error(...args);
    }
    // In production, you could send to a monitoring service like Sentry here
  },
};

export default logger;
