/**
 * server/logger.ts - Standardized logging for the LunchPad server.
 */

const getTimestamp = () => new Date().toISOString();

export const logger = {
  info: (msg: string, ...args: any[]) => {
    console.log(`[${getTimestamp()}] ℹ️ INFO: ${msg}`, ...args);
  },
  warn: (msg: string, ...args: any[]) => {
    console.warn(`[${getTimestamp()}] ⚠️ WARN: ${msg}`, ...args);
  },
  error: (msg: string, ...args: any[]) => {
    console.error(`[${getTimestamp()}] ❌ ERROR: ${msg}`, ...args);
  },
  db: (msg: string, ...args: any[]) => {
    if (process.env.DEBUG_DB) {
      console.log(`[${getTimestamp()}] 🗄️ DB: ${msg}`, ...args);
    }
  },
  ws: (msg: string, ...args: any[]) => {
    console.log(`[${getTimestamp()}] 🌐 WS: ${msg}`, ...args);
  },
  auth: (msg: string, ...args: any[]) => {
    console.log(`[${getTimestamp()}] 🔐 AUTH: ${msg}`, ...args);
  }
};
