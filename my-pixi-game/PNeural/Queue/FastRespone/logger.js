import fs from 'fs/promises';
import path from 'path';

const FAST_RESPONSE_LOG_PATH = path.join(process.cwd(), 'PNeural', 'Queue', 'FastRespone', 'Income');

export async function logFastResponse(message, type = 'info', meta = null) {
  const payload = meta ? `${message}\n${JSON.stringify(meta, null, 2)}` : message;
  const entry = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${payload}\n`;

  try {
    await fs.appendFile(FAST_RESPONSE_LOG_PATH, entry, 'utf-8');
  } catch (error) {
    console.error('[FastRespone Logger] Write failed:', error.message);
  }
}

export { FAST_RESPONSE_LOG_PATH };
