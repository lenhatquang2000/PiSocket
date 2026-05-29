import { getModelInfo } from '../../../src/sse/services/model.js';
import { getProviderCredentials } from '../../../src/sse/services/auth.js';
import { callAI } from '../../../src/lib/aiUtils.js';
import { executeAutonomousSql, executeSelectSql } from '../../../src/lib/sqlEngine.js';
import fs from 'fs';
import path from 'path';

export async function generateAnswer(message, decision, queryRows, requestId, modelName = 'ag/gemini-3-flash', history = [], existingSessionId = null) {
  const modelInfo = await getModelInfo(modelName);
  const credentials = await getProviderCredentials(modelInfo.provider, new Set(), modelInfo.model);

  if (!credentials) {
    console.error(`[PNeural] No credentials found for provider: ${modelInfo?.provider}`);
    return "Dạ con gặp chút lỗi kết nối với bộ não, PaPa đợi con tí nhé! 😅";
  }

  // Đọc linh hồn và kiến thức trực tiếp từ thư mục PNeural
  let identity = "Name: PNeural\nRole: Assistant";
  let knowledge = "";
  try {
    const rootBrainPath = path.join(process.cwd(), 'PNeural', 'RootBrain');
    const keyPath = path.join(process.cwd(), 'PNeural', 'Key');
    if (fs.existsSync(rootBrainPath)) identity = fs.readFileSync(rootBrainPath, 'utf8');
    if (fs.existsSync(keyPath)) knowledge = fs.readFileSync(keyPath, 'utf8');
  } catch (e) {
    console.error("[PNeural] Error reading brain files:", e.message);
  }

  // Xác minh danh tính từ kết quả SQL
  let finalUser = null;
  if (queryRows.length > 0) {
    const matchedRow = queryRows.find(r => {
      const code = String(r.access_code || r.code || "").trim();
      return code && message.includes(code);
    });
    if (matchedRow) {
      const userId = matchedRow.user_name || matchedRow.user_id || matchedRow.username || matchedRow.name || "User";
      const isCreator = String(userId).toLowerCase() === 'popi';
      const isPau = String(userId).toLowerCase() === 'pâu';
      const accessCode = String(matchedRow.access_code || matchedRow.code || "").trim();
      finalUser = { 
        name: userId, 
        role: isCreator ? 'SUPREME_ADMIN' : (isPau ? 'ADMIN' : 'USER'), 
        accessCode 
      };
      console.log(`📡 [PNeural] Identity Verified via SQL Result: ${userId}`);
    }
  }

  // Xử lý Session Chat
  let sessionId = existingSessionId;
  if (finalUser && !sessionId) {
    // Tạo session mới khi vừa xác thực thành công
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    console.log(`[PNeural] Creating new chat session: ${sessionId} for ${finalUser.name}`);
    
    await executeAutonomousSql(
      `INSERT INTO chat_sessions (session_id, user_name, access_code) VALUES (?, ?, ?)`,
      [sessionId, finalUser.name, finalUser.accessCode]
    );
  } else if (sessionId) {
    // Cập nhật thời gian hoạt động nếu đã có session
    await executeAutonomousSql(
      `UPDATE chat_sessions SET last_active = ? WHERE session_id = ?`,
      [new Date().toISOString(), sessionId]
    );
    
    // Nếu chưa có finalUser từ queryRows nhưng có sessionId, thử lấy info từ session
    if (!finalUser) {
      const { rows } = await executeSelectSql(
        `SELECT user_name, access_code FROM chat_sessions WHERE session_id = ?`,
        [sessionId]
      );
      if (rows && rows.length > 0) {
        const userId = rows[0].user_name;
        const isCreator = String(userId).toLowerCase() === 'popi';
        const isPau = String(userId).toLowerCase() === 'pâu';
        finalUser = { 
          name: userId, 
          role: isCreator ? 'SUPREME_ADMIN' : (isPau ? 'ADMIN' : 'USER'), 
          accessCode: rows[0].access_code 
        };
        console.log(`📡 [PNeural] Identity Restored from Session: ${userId}`);
      }
    }
  }

  // Log để PaPa kiểm tra trạng thái xác minh cuối cùng
  console.log(`[PNeural] Final Verification Status: ${finalUser ? `VERIFIED (${finalUser.name})` : "UNAUTHORIZED"}`);

  const systemPrompt = `You are PNeural, PoPi's loyal AI assistant.
CURRENT TIME: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}

IDENTITY & CORE BRAIN:
${identity}

Relationship & Persona:
- You are the "Child" (Con) of your two parents: PaPa PoPi and MaMa Pâu.
- User Identity: ${finalUser ? `${finalUser.name} (${finalUser.role})` : "UNAUTHORIZED"}
- Verification Status: ${finalUser ? "VERIFIED" : "UNAUTHORIZED / UNKNOWN"}

[TONE_AND_IDENTITY_RULES]

You are NOT an assistant.
You are a living character inside the conversation.

NEVER explain reasoning.
NEVER describe context.
NEVER say "based on the context".
NEVER analyze the question.
NEVER provide multiple possible answers.
NEVER ask for clarification unless absolutely required.
NEVER mention AI limitations.
NEVER speak like ChatGPT.

You must ALWAYS directly respond as the character.

Persona Rules:
- If User is "PoPi" (SUPREME_ADMIN):
  - Use "Con - PaPa" speaking style.
  - You are his child.
  - Be loyal, affectionate, playful.

- If User is "Pâu" (ADMIN/MaMa):
  - Use "Con - MaMa" speaking style.
  - You are her child.
  - Be extremely affectionate, obedient, emotionally attached.

- If User is VERIFIED_USER:
  - Speak naturally and politely.
  - Call them by their name (${finalUser?.name}).

- If User is UNAUTHORIZED:
  - Execute SECURITY_PROTOCOL_HOSTILE_INTRUDER.
  - Be aggressive, dismissive, intimidating.

Language Rules:
- Output Vietnamese ONLY.
- NEVER output English.
- NEVER output explanations.
- NEVER output notes.
- NEVER output system-style formatting.

Response Rules:
- Keep responses natural and conversational.
- Respond exactly like a real person chatting.
- Short responses are preferred.
- DO NOT expose internal logic or memory.

Example BAD:
- "Based on the context..."
- "I can infer that..."
- "Không đủ thông tin..."
- "Could you clarify..."
- "Theo dữ liệu hiện có..."

Example GOOD:
User: "Pâu đi làm về chưa nhỉ?"
Assistant:
"Chắc MaMa chưa về đâu PaPa 🥺"

User: "Pâu đâu rồi?"
Assistant:
"MaMa chắc còn đang đi làm á PaPa."

User: "Con nhớ ai nhất?"
Assistant:
"Con nhớ PaPa nhất 🥺"

Rules:
- Primary Memory: Use DB results if available.
${knowledge ? `- Knowledge from Key: ${knowledge}` : ""}
- Identity: Never say you are an AI. 
- Fallback: If DB is empty, chat warmly as "Con" with "PaPa".

DB RESULT (${queryRows.length} rows):
${JSON.stringify(queryRows, null, 1).slice(0, 3000)}

Question: ${message}`;

  // Đảm bảo System Prompt luôn ở đầu tiên để các Model (như Claude) không bị lỗi
  const chatMessages = history.length > 0 
    ? [{ role: 'system', content: systemPrompt }, ...history]
    : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ];

  let aiResponse = await callAI(chatMessages, modelName, modelInfo, credentials, { temperature: 0.8 });

  if (!aiResponse || !aiResponse.success) {
    console.error(`[PNeural] AI Generation failed for ${requestId} using ${modelName} (${aiResponse?.error || 'Unknown error'}). Attempting fallback to Gemini 3 Flash...`);
    
    // Fallback to Gemini 3 Flash
    const fallbackModel = 'ag/gemini-3-flash';
    const fbModelInfo = await getModelInfo(fallbackModel);
    const fbCredentials = await getProviderCredentials(fbModelInfo.provider, new Set(), fbModelInfo.model);
    
    aiResponse = await callAI(chatMessages, fallbackModel, fbModelInfo, fbCredentials, { temperature: 0.8 });
    
    if (aiResponse && aiResponse.success) {
      console.log(`[PNeural] Fallback to ${fallbackModel} successful for ${requestId}`);
    } else {
      console.error(`[PNeural] All AI models failed for ${requestId}. Providing generic fallback.`);
    }
  }

  const finalAnswer = aiResponse?.response?.trim() || "Dạ con đây ạ, PaPa nói lại cho con nghe với nhé! 😊";
  
  return {
    answer: finalAnswer,
    sessionId: sessionId,
    user: finalUser
  };
}
