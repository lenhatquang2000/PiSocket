import fs from 'fs/promises';
import path from 'path';

const COGNITIVE_LOG_PATH = path.join(process.cwd(), 'PNeural', 'Queue', 'Cognitive', 'Final');

export async function logCognitive(message, type = 'info', meta = null) {
  const payload = meta ? `${message}\n${JSON.stringify(meta, null, 2)}` : message;
  const entry = `[${new Date().toISOString()}] [${type.toUpperCase()}] ${payload}\n`;

  try {
    await fs.appendFile(COGNITIVE_LOG_PATH, entry, 'utf-8');
  } catch (error) {
    console.error('[Cognitive Logger] Write failed:', error.message);
  }
}

export { COGNITIVE_LOG_PATH };
