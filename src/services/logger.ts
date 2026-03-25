const isDev = import.meta.env.DEV;

export const logger = {
  info:  (ctx: string, msg: string, ...args: unknown[]) => { if (isDev) console.info( `[${ctx}] ${msg}`, ...args); },
  warn:  (ctx: string, msg: string, ...args: unknown[]) => { if (isDev) console.warn( `[${ctx}] ${msg}`, ...args); },
  error: (ctx: string, msg: string, ...args: unknown[]) => {             console.error(`[${ctx}] ${msg}`, ...args); },
};
