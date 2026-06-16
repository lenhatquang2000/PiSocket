import { tryFastHeuristic } from './checkHeuristic.js';
import { getIntent } from './getIntent.js';
import { executeSQL } from './executeSQL.js';
import { generateAnswer } from './generateAnswer.js';
import { logFastResponse } from './logger.js';

export async function runFastResponseQueue({ message, messages, model, requestId, sessionId: existingSessionId = null }) {
  const startedAt = Date.now();
  await logFastResponse(`[${requestId}] Starting FastResponse Flow (Gateway Mode)`, 'info', { message, model, sessionId: existingSessionId });

  try {
    // Bước 1: Thử Heuristic (trả lời nhanh không cần AI)
    const heuristic = await tryFastHeuristic(message, requestId);
    if (heuristic) {
      await logFastResponse(`[${requestId}] Heuristic match found`, 'info', heuristic);
      return heuristic;
    }

    // Bước 2: Phân tích Ý định bằng AI (Dùng Gemini Flash cho tốc độ tối đa)
    const intent = await getIntent(message, requestId);
    await logFastResponse(`[${requestId}] AI Intent Analysis`, 'debug', intent);

    let contextRows = [];
    if (intent.isQuery) {
      // Bước 3: Thực thi SQL SELECT nếu là query
      contextRows = await executeSQL(intent, requestId);
      await logFastResponse(`[${requestId}] SQL Results`, 'debug', { rowCount: contextRows.length, sample: contextRows[0] });
    }

    // Bước 4: Gọi AI duy nhất (generateAnswer) để tổng hợp câu trả lời
    const result = await generateAnswer(message, intent, contextRows, requestId, model, messages, existingSessionId);
    
    await logFastResponse(`[${requestId}] Final Answer Generated`, 'info', { answer: result.answer, sessionId: result.sessionId });

    return { 
      answer: result.answer, 
      sessionId: result.sessionId,
      user: result.user,
      contextData: 'GeneralChat' 
    };

  } catch (error) {
    await logFastResponse(`[${requestId}] FastResponse Flow Failed`, 'error', error.message);
    throw error;
  }
}
