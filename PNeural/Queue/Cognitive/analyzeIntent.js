import { getModelInfo } from '../../../src/sse/services/model.js';
import { getProviderCredentials } from '../../../src/sse/services/auth.js';

export async function analyzeIntent(message, history = [], requestId) {
  const modelName = 'ag/gemini-3-flash';
  const modelInfo = await getModelInfo(modelName);
  const credentials = await getProviderCredentials(modelInfo.provider, new Set(), modelInfo.model);

  const formattedHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

  const systemPrompt = `Analyze user intent for long-term memory storage based on current message and CHAT HISTORY.
Directives:
1. set 'shouldSave: true' IF user provides ANY personal details, including:
   - Name, Identity, Access Codes.
   - Relationships, Family, Friends.
   - Hobbies, Interests, Skills.
   - Health, Mood, Feelings.
   - Wishes, Dreams, Aspirations (e.g., "ước gì...", "muốn...").
   - Preferences, Likes/Dislikes.
   - Opinions, Personal Context, or significant life events.
2. set 'shouldSave: false' ONLY IF it is a generic greeting, general knowledge question, or completely empty of personal context.
3. set 'shouldSave: false' IF:
   - User is ASKING/TESTING your memory (e.g., "Bạn biết tôi thích gì không?", "Nhắc lại tên tôi xem").
   - User is just greeting, making small talk, or asking general knowledge.
   - The message contains no actual facts or personal details to remember.

CORE GOAL: Capture NEW facts to build the user's persona.

CHAT HISTORY:
${formattedHistory}

Output JSON ONLY:
{
  "shouldSave": boolean,
  "reason": "Giải thích ngắn gọn bằng tiếng Việt (có xét đến ngữ cảnh)",
  "extractedData": { 
    "userName": "string or empty", 
    "details": "Tóm tắt thông tin MỚI cần lưu (Tiếng Việt)" 
  }
}`;

  const { callAI, extractJSON } = await import('../../../src/lib/aiUtils.js');
  const result = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Current Message: ${message}` }
  ], modelName, modelInfo, credentials, { temperature: 0 });

  const text = result?.response || "";
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { shouldSave: false };
}
