/**
 * Debug helper - send client logs to server
 */
let debugSocket = null;

export function initDebugHelper(socket) {
  debugSocket = socket;
}

export function sendDebugLog(message) {
  if (debugSocket) {
    debugSocket.emit('client-debug-log', { message, timestamp: new Date().toISOString() });
  }
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
  
  console.log(...args);
  sendDebugLog(message);
}
