import { diagnostic } from './diagnostics.ts';
export type ProbeStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'unknown';
export type ProbeOutcome = { status: ProbeStatus; code?: string };
export type ProbeResult = ProbeOutcome & { service_id: string; service_name: string; response_time_ms: number; error_message?: string };
export function httpOutcome(status: number): ProbeOutcome {
  if (status >= 200 && status < 300) return { status: 'operational' };
  if (status === 429) return { status: 'degraded', code: 'rate_limited' };
  if (status === 401 || status === 403) return { status: 'unknown', code: 'probe_not_authorized' };
  if (status >= 500 || status === 408) return { status: 'major_outage', code: `http_${status}` };
  return { status: 'unknown', code: `unexpected_http_${status}` };
}
export async function probe(id: string, name: string, work: () => Promise<ProbeOutcome>, pause = () => new Promise(resolve => setTimeout(resolve, 250)), clock = Date.now): Promise<ProbeResult> {
  let outcome: ProbeOutcome = { status: 'unknown' }; let duration = 0; let attempt = 0;
  for (attempt = 1; attempt <= 2; attempt++) {
    const start = clock();
    try { outcome = await work(); }
    catch { outcome = { status: 'major_outage', code: 'connection_or_timeout' }; }
    duration = Math.max(0, clock() - start);
    if (outcome.status !== 'major_outage' && outcome.status !== 'partial_outage') break;
    if (attempt === 1) await pause();
  }
  const attempts = Math.min(attempt, 2);
  if (outcome.status !== 'operational' || attempts > 1) diagnostic(outcome.status === 'major_outage' ? 'error' : 'warning', 'health_probe', { service: id, code: outcome.code ?? 'recovered', attempt: attempts, duration_ms: duration });
  return { service_id: id, service_name: name, ...outcome, response_time_ms: duration,
    ...(outcome.code ? { error_message: `${outcome.code}${attempts === 2 && (outcome.status === 'major_outage' || outcome.status === 'partial_outage') ? ' (confirmado em 2 tentativas)' : ''}` } : {}) };
}
export function overallProbeStatus(statuses: ProbeStatus[]): ProbeStatus {
  if (!statuses.length) return 'unknown';
  if (statuses.every(status => status === 'major_outage')) return 'major_outage';
  if (statuses.some(status => status === 'major_outage' || status === 'partial_outage')) return 'partial_outage';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.includes('unknown')) return 'unknown';
  return 'operational';
}
