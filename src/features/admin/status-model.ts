import { subDays } from 'date-fns';
import { brazilDateKey } from './stats';

export type ServiceStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'checking' | 'unknown';
export type DayStatus = { date: Date; status: ServiceStatus; checks: number; operational: number };
export type Incident = {
  id: string; title: string; status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical'; createdAt: Date; affectedServices: string[]; message: string;
};

export function overallStatus(statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.length === 0) return 'unknown';
  if (statuses.every(status => status === 'major_outage')) return 'major_outage';
  if (statuses.some(status => status === 'partial_outage' || status === 'major_outage')) return 'partial_outage';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.includes('unknown')) return 'unknown';
  if (statuses.every(status => status === 'operational')) return 'operational';
  return 'degraded';
}
export function currentStatus(status: string | undefined, createdAt: string | undefined, now = Date.now()): ServiceStatus {
  const age = now - Date.parse(createdAt || '');
  if (!Number.isFinite(age) || age < -60000 || age > 7 * 60000) return 'unknown';
  return ['operational','degraded','partial_outage','major_outage','unknown'].includes(status || '') ? status as ServiceStatus : 'unknown';
}
export interface StatusSnapshot {
  observed_at: string;
  latest: { service_id: string; status: string; response_time_ms: number | null; error_message: string | null; created_at: string; run_id: string | null }[];
  stats: { service_id: string; checked: number; available: number; unknown_checks: number; availability: number | null; since: string }[];
  days: { service_id: string; date: string; checks: number; operational: number; available: number; degraded: number; failed: number; unknown_checks: number }[];
}
export function buildAggregatedHistory(serviceIds: string[], days: StatusSnapshot['days'], today = new Date()) {
  const history = buildUptimeHistory(serviceIds, [], today);
  for (const item of days) {
    const day = history[item.service_id]?.find(value => brazilDateKey(value.date) === item.date);
    if (!day) continue;
    day.checks = item.checks; day.operational = item.operational;
    day.status = item.failed > 0 ? (item.failed === item.checks ? 'major_outage' : 'partial_outage') : item.degraded > 0 ? 'degraded' : item.unknown_checks > 0 ? 'unknown' : 'operational';
  }
  return history;
}

export function buildUptimeHistory(serviceIds: string[], checks: Array<{ service_id: string; status: string; created_at: string }>, today = new Date()) {
  const days: Record<string, DayStatus[]> = Object.fromEntries(serviceIds.map(id => [id, Array.from({ length: 90 }, (_, index) => ({
    date: new Date(`${brazilDateKey(subDays(today, 89 - index))}T12:00:00Z`), status: 'unknown' as ServiceStatus, checks: 0, operational: 0,
  }))]));
  for (const check of checks) {
    const history = days[check.service_id];
    if (!history) continue;
    const day = history.find(item => brazilDateKey(item.date) === brazilDateKey(new Date(check.created_at)));
    if (!day) continue;
    day.checks++;
    if (check.status === 'operational') day.operational++;
    day.status = day.checks === 1 ? check.status as ServiceStatus : overallStatus([day.status,check.status as ServiceStatus]);
  }
  return days;
}

const titles: Record<string, string> = {
  worker_stale: 'Worker sem sinal recente', queue_stale: 'Fila aguardando processamento', output_stale: 'Persistência de fotos pendente',
  prediction_uncertain: 'Envio aguardando reconciliação', budget_70: 'Exposição financeira acima de 70%', budget_85: 'Exposição financeira acima de 85%', generation_errors: 'Aumento de falhas de geração',
  error_spike: 'Aumento de Erros Detectado', slow_processing: 'Lentidão no Processamento',
  high_usage: 'Alto Volume de Requisições', api_error: 'Erro na API Externa',
};
const affected: Record<string, string[]> = {
  worker_stale: ['edge-functions'], queue_stale: ['edge-functions'], output_stale: ['edge-functions','cdn'],
  prediction_uncertain: ['replicate'], budget_70: [], budget_85: [], generation_errors: ['replicate','edge-functions'],
  error_spike: ['edge-functions', 'replicate'], slow_processing: ['edge-functions', 'replicate'],
  high_usage: ['database', 'edge-functions'], api_error: ['replicate'],
};
export function toIncident(alert: { id: string; type: string; operation_key?: string | null; severity: string; created_at: string; message: string }): Incident {
  const kind=alert.operation_key || alert.type;
  return {
    id: alert.id, title: titles[kind] || 'Incidente Detectado', status: 'investigating',
    severity: alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'major' : 'minor',
    createdAt: new Date(alert.created_at), affectedServices: affected[kind] || [], message: alert.message,
  };
}
