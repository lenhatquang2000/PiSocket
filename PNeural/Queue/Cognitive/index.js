import { analyzeIntent } from './analyzeIntent.js';
import { designSchema } from './designSchema.js';
import { executeMutation } from './executeMutation.js';
import { logCognitive } from './logger.js';

export async function runCognitiveQueue({ message, messages, requestId }) {
  const startedAt = Date.now();
  await logCognitive(`[${requestId}] Starting Cognitive Flow`, 'info', { message });

  try {
    // Bước 1: Phân tích xem có dữ liệu mới cần lưu không (Gửi kèm Context)
    const intent = await analyzeIntent(message, messages, requestId);
    await logCognitive(`[${requestId}] Intent Analysis`, 'debug', intent);

    if (intent && intent.shouldSave) {
      // Bước 2: AI thiết kế SQL (Schema Design)
      let decision = await designSchema(message, intent, messages, requestId);
      await logCognitive(`[${requestId}] DB Design Decision`, 'debug', decision);

      if (decision && decision.sqlCommands) {
        // Bước 3: Thực thi SQL
        let mutationResult = await executeMutation(decision, requestId);
        
        // TỰ SUY LUẬN VÀ SỬA LỖI (Self-Correction)
        if (!mutationResult.success) {
          await logCognitive(`[${requestId}] SQL Error detected. Attempting self-correction...`, 'warn', { error: mutationResult.error });
          
          // Gửi lỗi ngược lại cho AI để nó suy luận cách sửa (VD: thêm cột thiếu)
          const retryDecision = await designSchema(message, intent, messages, requestId, {
            error: mutationResult.error,
            tableName: decision.tableName,
            failedSql: mutationResult.failedSql
          });
          
          if (retryDecision && retryDecision.sqlCommands) {
            await logCognitive(`[${requestId}] Self-Correction Plan`, 'debug', retryDecision);
            mutationResult = await executeMutation(retryDecision, requestId);
          }
        }

        if (mutationResult.success) {
          await logCognitive(`[${requestId}] Data Persisted`, 'info', { tableName: decision.tableName });
          return { success: true, saved: true };
        }
      }
    }

    return { success: true, saved: false };
  } catch (error) {
    await logCognitive(`[${requestId}] Cognitive Flow Failed`, 'error', error.message);
    throw error;
  }
}
