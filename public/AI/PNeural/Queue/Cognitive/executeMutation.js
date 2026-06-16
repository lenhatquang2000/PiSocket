import { executeAutonomousSql, updateModalIndex, getFullDatabaseSchema } from '../../../src/lib/sqlEngine.js';
import { logCognitive } from './logger.js';

export async function executeMutation(decision, requestId) {
  if (!decision || !decision.sqlCommands) return;

  const forbidden = ['drop', 'delete', 'truncate'];
  
  for (const cmd of decision.sqlCommands) {
    const lower = cmd.sql.toLowerCase();
    if (forbidden.some(f => lower.includes(f))) {
      await logCognitive(`[${requestId}] BLOCKED forbidden SQL: ${cmd.sql}`, 'warn');
      continue;
    }

    const result = await executeAutonomousSql(cmd.sql, cmd.params || []);
    await logCognitive(`[${requestId}] SQL executed`, 'debug', {
      sql: cmd.sql,
      params: cmd.params,
      success: result.success,
      error: result.error || null,
    });

    if (!result.success) {
      return { success: false, error: result.error, failedSql: cmd.sql };
    }
  }

  // Sau mọi thay đổi (CREATE, ALTER, INSERT), đọc lại schema thật từ DB
  if (decision.tableName) {
    const freshSchema = await getFullDatabaseSchema();
    const lines = freshSchema.split('\n');
    const tableSchema = lines.find(l => l.startsWith(`Table: ${decision.tableName}`)) 
      || `Table: ${decision.tableName} [schema pending]`;

    await updateModalIndex(decision.tableName, tableSchema, decision.reason || 'PNeural Memory');
    await logCognitive(`[${requestId}] DBModal/index updated for table: ${decision.tableName}`, 'info');
  }

  return { success: true };
}
