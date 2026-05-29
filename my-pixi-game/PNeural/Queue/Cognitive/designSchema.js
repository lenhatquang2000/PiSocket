import { getFullDatabaseSchema, getDbModalIndex } from '../../../src/lib/sqlEngine.js';
import { getModelInfo } from '../../../src/sse/services/model.js';
import { getProviderCredentials } from '../../../src/sse/services/auth.js';

export async function designSchema(message, aiIntent, history = [], requestId, previousError = null) {
  const modalIndex = await getDbModalIndex();
  const fullSchema = await getFullDatabaseSchema();
  
  const modelName = 'ag/gemini-3-flash';
  const modelInfo = await getModelInfo(modelName);
  const credentials = await getProviderCredentials(modelInfo.provider, new Set(), modelInfo.model);

  const formattedHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

  const errorContext = previousError ? `
⚠️ PREVIOUS SQL ERROR:
${JSON.stringify(previousError, null, 2)}
Please analyze this error and provide a fix. If a column is missing, you may need to use "ALTER TABLE ${previousError.tableName || 'table_name'} ADD COLUMN column_name TEXT".` : '';

  const systemPrompt = `You are PNeural's autonomous Database Architect.

TASK: Design SQL to persist user information. 
${errorContext}

THINKING PROCESS:
1. CLASSIFY data.
2. CHECK existing schema.
3. If table exists but schema is different, use ALTER TABLE to add missing columns.
4. ALWAYS include: id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, context TEXT, raw_input TEXT.

EXISTING SCHEMA:
${fullSchema}

CHAT HISTORY:
${formattedHistory}

Output JSON ONLY:
{
  "shouldSave": true,
  "tableName": "category_name",
  "reason": "brief reason",
  "sqlCommands": [
    {"sql": "...", "params": []}
  ]
}`;

  const { callAI, extractJSON } = await import('../../../src/lib/aiUtils.js');
  const result = await callAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Intent: ${JSON.stringify(aiIntent)}\nMessage: ${message}` }
  ], modelName, modelInfo, credentials, { temperature: 0 });

  const text = result?.response || "";
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}
