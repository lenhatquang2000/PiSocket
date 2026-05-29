import { executeSelectSql } from '../../../src/lib/sqlEngine.js';

function looksLikePreferenceFoodQuestion(prompt) {
  if (!prompt) return false;
  const p = String(prompt).toLowerCase();
  return (p.includes('thích ăn') || p.includes('ăn cái gì') || p.includes('ăn gì'));
}

function extractLeadingName(prompt) {
  if (!prompt) return null;
  const first = String(prompt).trim().split(/\s+/)[0];
  if (!first) return null;
  const lower = first.toLowerCase();
  if (lower === 'tôi' || lower === 'tao' || lower === 'mình' || lower === 'minh') return null;
  if (/^[\?\!\.,:;]+$/.test(first)) return null;
  if (first.length > 32) return null;
  return first;
}

export async function tryFastHeuristic(message, requestId) {
  const userName = extractLeadingName(message);
  if (!userName) return null;

  // Tìm kiếm rộng trên nhiều bảng tiềm năng
  const queries = [
    { sql: `SELECT identity_statement as content FROM user_identity WHERE user_name = ?`, params: [userName] },
    { sql: `SELECT memory_content as content FROM chat_memories WHERE user_name = ? OR memory_content LIKE ?`, params: [userName, `%${userName}%`] }
  ];

  let rawContext = "";
  for (const q of queries) {
    const res = await executeSelectSql(q.sql, q.params);
    if (res.success && res.rows.length > 0) {
      rawContext += res.rows.map(r => r.content).join(" | ");
    }
  }

  if (!rawContext) return null;

  // Dùng AI siêu tốc để trích xuất câu trả lời từ dữ liệu thô
  const { callAI } = await import('../../../src/lib/aiUtils.js');
  const { getModelInfo } = await import('../../../src/sse/services/model.js');
  const { getProviderCredentials } = await import('../../../src/sse/services/auth.js');

  const modelName = 'kr/claude-haiku-4.5'; // Model siêu tốc
  const modelInfo = await getModelInfo(modelName);
  const credentials = await getProviderCredentials(modelInfo.provider, new Set(), modelInfo.model);

  const extractPrompt = `Extract answer for: "${message}" 
Context: ${rawContext.slice(0, 2000)}
Rules:
- If context has info, answer briefly.
- If no info, return "null".
- Address as PaPa PoPi, self as Con.`;

  const aiRes = await callAI([{ role: 'system', content: extractPrompt }], modelName, modelInfo, credentials, { temperature: 0 });

  if (!aiRes.success || aiRes.response.toLowerCase().includes("null")) return null;

  return { answer: aiRes.response, contextData: 'FastHeuristicAI' };
}
