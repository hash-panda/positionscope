/**
 * Safe logger wrapper to prevent EPIPE errors when writing to closed streams
 * This commonly occurs in Electron apps when the console is closed or during shutdown
 */

function safeWrite(fn: Function, ...args: any[]): void {
  try {
    fn(...args);
  } catch (error: any) {
    // Silently ignore EPIPE errors which occur when writing to closed streams
    if (error.code === 'EPIPE' || error.message?.includes('EPIPE')) {
      return;
    }
    // For other errors, try to report them but don't throw
    try {
      process.stderr.write('[Logger] Write failed\n');
    } catch {
      // If we can't even write to stderr, just give up silently
    }
  }
}

export const logger = {
  log: (...args: any[]) => safeWrite(console.log, ...args),
  error: (...args: any[]) => safeWrite(console.error, ...args),
  warn: (...args: any[]) => safeWrite(console.warn, ...args),
  info: (...args: any[]) => safeWrite(console.info, ...args),
  debug: (...args: any[]) => safeWrite(console.debug, ...args),
};
