type Level = 'info' | 'warning' | 'error';
const identifiers = new Set(['function', 'stage', 'code', 'error_name', 'rpc', 'service', 'request_id', 'generation_id', 'team_id']);
const numbers = new Set(['http_status', 'duration_ms', 'attempt', 'processed']);
export function diagnosticRecord(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const record: Record<string, unknown> = { timestamp: new Date().toISOString(), level, event: /^[a-z0-9_]{1,80}$/i.test(event) ? event : 'unexpected_event' };
  for (const [key, value] of Object.entries(fields)) {
    if (identifiers.has(key) && typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value)) record[key] = value;
    if (numbers.has(key) && typeof value === 'number' && Number.isFinite(value)) record[key] = Math.round(value);
  }
  return record;
}
export function diagnostic(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const value = JSON.stringify(diagnosticRecord(level, event, fields));
  if (level === 'error') console.error(value);
  else if (level === 'warning') console.warn(value);
  else console.info(value);
}
