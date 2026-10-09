const sessionId = crypto.randomUUID();
export function diagnosticRecord(event: string, error: unknown, context: Record<string, unknown> = {}) {
  const record: Record<string, unknown> = { timestamp: new Date().toISOString(), source: 'browser', session_id: sessionId, event: /^[a-z0-9_]{1,80}$/i.test(event) ? event : 'unexpected_error' };
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : 'unknown';
  if (/^[a-z0-9_]{1,80}$/i.test(name)) record.error_name = name;
  for (const key of ['function','stage','code','request_id','generation_id']) {
    const value = context[key];
    if (typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value)) record[key] = value;
  }
  for (const key of ['http_status','duration_ms','line','column']) if (typeof context[key] === 'number' && Number.isFinite(context[key])) record[key] = Math.round(context[key] as number);
  // Keep a code location, never raw exception text, query strings or stack payloads.
  if (error instanceof Error) {
    const frame = error.stack?.match(/\/(?:src|assets)\/[a-z0-9_./-]+\.(?:tsx?|js):\d+:\d+/i)?.[0];
    if (frame) record.location = frame;
  }
  return record;
}
export function reportError(event: string, error: unknown, context: Record<string, unknown> = {}, warning = false) {
  const record = JSON.stringify(diagnosticRecord(event, error, context));
  if (warning) console.warn(record); else console.error(record);
}
export function installGlobalDiagnostics() {
  const onError = (event: ErrorEvent) => reportError('browser_error', event.error, { line: event.lineno, column: event.colno });
  const onRejected = (event: PromiseRejectionEvent) => reportError('unhandled_rejection', event.reason);
  window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejected);
  return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejected); };
}
