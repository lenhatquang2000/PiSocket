/**
 * Debug helper - send client logs to server terminal only
 */
let debugSocket = null;

export function initDebugHelper(socket) {
  debugSocket = socket;
}

export function debugLog(...args) {
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  // Send to server terminal only, don't log to browser console
  if (debugSocket) {
    debugSocket.emit('client-debug-log', { message, timestamp: new Date().toISOString() });
  }
}
