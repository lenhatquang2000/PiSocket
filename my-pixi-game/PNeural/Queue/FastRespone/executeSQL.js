import { executeSelectSql } from '../../../src/lib/sqlEngine.js';
import { logFastResponse } from './logger.js';

export async function executeSQL(decision, requestId) {
  if (!decision.sqlQueries || !Array.isArray(decision.sqlQueries)) {
    return [];
  }

  let allRows = [];
  for (const queryObj of decision.sqlQueries) {
    try {
      const result = await executeSelectSql(queryObj.sql, queryObj.params || []);
      if (result.success && result.rows) {
        console.log(`📡 [SQL] Executed: ${queryObj.sql} | Params: ${JSON.stringify(queryObj.params)}`);
        console.log(`📊 [SQL] Found ${result.rows.length} rows.`);
        allRows = allRows.concat(result.rows);
      }
    } catch (error) {
      await logFastResponse(`[${requestId}] SQL Execution failed`, 'error', { 
        sql: queryObj.sql, 
        error: error.message 
      });
    }
  }

  return allRows;
}
