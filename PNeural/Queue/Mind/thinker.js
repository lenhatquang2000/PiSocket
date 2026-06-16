import { getFullDatabaseSchema, executeSelectSql } from '../../../src/lib/sqlEngine.js';
import { getModelInfo } from '../../../src/sse/services/model.js';
import { getProviderCredentials } from '../../../src/sse/services/auth.js';
import { callAI } from '../../../src/lib/aiUtils.js';
import fs from 'fs';
import path from 'path';

const TOPIC_DIR = path.join(process.cwd(), 'PNeural', 'Queue', 'Mind', 'Topic');

/**
 * Suy ngẫm về người dùng dựa trên dữ liệu hiện có
 * Mục tiêu: Tìm ra những điều PNeural còn tò mò hoặc muốn biết thêm
 */
export async function thinkAboutUsers() {
  console.log('[PNeural Mind] Thinking session started...');
  
  try {
    if (!fs.existsSync(TOPIC_DIR)) {
      fs.mkdirSync(TOPIC_DIR, { recursive: true });
    }

    const schema = await getFullDatabaseSchema();
    
    // Lấy danh sách các session hoạt động gần đây
    const { rows: sessions } = await executeSelectSql(
      `SELECT DISTINCT user_name FROM chat_sessions ORDER BY last_active DESC LIMIT 10`
    );

    if (!sessions || sessions.length === 0) {
      console.log('[PNeural Mind] No active sessions found to think about.');
      return;
    }

    for (const session of sessions) {
      const userName = session.user_name;
      if (!userName || userName === 'User') continue;

      console.log(`[PNeural Mind] Reflecting on user: ${userName}`);
      
      // Thu thập dữ liệu tóm tắt về user này
      const { rows: prefs } = await executeSelectSql(`SELECT preference FROM user_preferences WHERE user_name = ?`, [userName]);
      const { rows: memories } = await executeSelectSql(`SELECT memory_content FROM chat_memories WHERE user_name = ?`, [userName]);
      const { rows: identity } = await executeSelectSql(`SELECT identity_statement FROM user_identity WHERE user_name = ?`, [userName]);

      const userContext = `
        User Name: ${userName}
        Identity: ${identity.map(i => i.identity_statement).join(', ')}
        Preferences: ${prefs.map(p => p.preference).join(', ')}
        Memories: ${memories.map(m => m.memory_content).join('; ')}
      `;

      // Gọi AI để suy luận topic (Dùng model rẻ/nhanh để tiết kiệm token)
      const modelName = 'ag/gemini-3-flash';
      const modelInfo = await getModelInfo(modelName);
      const credentials = await getProviderCredentials(modelInfo.provider, new Set(), modelInfo.model);

      const prompt = `You are PNeural's Mind Queue.
Analyze the following user data and identify 3-5 things you are CURIOUS about or want to understand better to serve them.
Focus on: Personal life, aspirations, details of their hobbies, or follow-ups on past mentions.

USER DATA:
${userContext}

TASK: Generate 3 short, conversational, and caring Vietnamese sentences that PNeural could use to start a conversation when the user is idle.
RULES:
- ONLY output the numbered list.
- NO introduction, NO explanation, NO conclusion.
- Each line starts with "1.", "2.", etc.

FORMAT:
1. [Topic 1]
2. [Topic 2]
3. [Topic 3]`;

      const aiResponse = await callAI([
        { role: 'system', content: 'You are a thoughtful and curious AI mind.' },
        { role: 'user', content: prompt }
      ], modelName, modelInfo, credentials, { temperature: 0.7 });

      if (aiResponse && aiResponse.response) {
        const filePath = path.join(TOPIC_DIR, `${userName}.txt`);
        fs.writeFileSync(filePath, aiResponse.response, 'utf8');
        console.log(`[PNeural Mind] Saved topics for ${userName}`);
      }
    }
  } catch (error) {
    console.error('[PNeural Mind] Thinking failed:', error.message);
  }
}
