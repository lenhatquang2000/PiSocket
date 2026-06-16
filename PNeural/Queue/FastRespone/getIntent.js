import { getDbModalIndex, getFullDatabaseSchema } from '../../../src/lib/sqlEngine.js';
import { getModelInfo } from '../../../src/sse/services/model.js';
import { getProviderCredentials } from '../../../src/sse/services/auth.js';

export async function getIntent(message, requestId) {
  const modalIndex = await getDbModalIndex();
  const fullSchema = await getFullDatabaseSchema();
  
  const modelName = 'ag/gemini-3-flash';
  const modelInfo = await getModelInfo(modelName);
  const credentials = await getProviderCredentials(modelInfo.provider, new Set(), modelInfo.model);

  const systemPrompt = `You are PNeural Data Architect. 
CURRENT TIME: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}

TASK: Analyze if user is:
1. ASKING about stored info OR providing identifying codes/info (Query).
2. PROVIDING info to remember (Save).

DB MODAL INDEX:
${modalIndex}

ACTUAL DB SCHEMA:
${fullSchema}

RULES:
- If user provides an access code (e.g. "333") or asks "who am I?", it IS a query to check identity tables.
- Return JSON: {"isQuery": true, "sqlQueries": [{"sql": "SELECT * FROM ...", "params": []}], "reason": "..."}
- If SAVE, return: {"isQuery": false, "isSave": true}
- Otherwise, return: {"isQuery": false}`;

  const { callAI, extractJSON } = await import('../../../src/lib/aiUtils.js');
  
  const aiResponse = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ], modelName, modelInfo, credentials, { temperature: 0 });

  if (!aiResponse || !aiResponse.response) return { isQuery: false };

  return extractJSON(aiResponse.response) || { isQuery: false };
}
