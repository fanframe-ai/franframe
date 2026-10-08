import { startOfDay, subDays } from 'date-fns';

export type ServiceStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'checking' | 'unknown';
export type DayStatus = { date: Date; status: ServiceStatus; checks: number; operational: number };
export type Incident = {
  id: string; title: string; status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical'; createdAt: Date; affectedServices: string[]; message: string;
};

export function overallStatus(statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.length === 0) return 'unknown';
  if (statuses.some(status => status === 'major_outage')) return 'major_outage';
  if (statuses.some(status => status === 'partial_outage')) return 'partial_outage';
  if (statuses.includes('unknown')) return 'unknown';
  if (statuses.every(status => status === 'operational')) return 'operational';
  return 'degraded';
}

export function buildUptimeHistory(serviceIds: string[], checks: Array<{ service_id: string; status: string; created_at: string }>, today = new Date()) {
  const days: Record<string, DayStatus[]> = Object.fromEntries(serviceIds.map(id => [id, Array.from({ length: 90 }, (_, index) => ({
    date: startOfDay(subDays(today, 89 - index)), status: 'unknown' as ServiceStatus, checks: 0, operational: 0,
  }))]));
  for (const check of checks) {
    const history = days[check.service_id];
    if (!history) continue;
    const date = startOfDay(new Date(check.created_at)).getTime();
    const day = history.find(item => item.date.getTime() === date);
    if (!day) continue;
    day.checks++;
    if (check.status === 'operational') day.operational++;
  }
  for (const history of Object.values(days)) for (const day of history) {
    if (day.checks === 0) continue;
    const ratio = day.operational / day.checks;
    day.status = ratio >= .95 ? 'operational' : ratio >= .8 ? 'degraded' : ratio >= .5 ? 'partial_outage' : 'major_outage';
  }
  return days;
}

const titles: Record<string, string> = {
  error_spike: 'Aumento de Erros Detectado', slow_processing: 'Lentidão no Processamento',
  high_usage: 'Alto Volume de Requisições', api_error: 'Erro na API Externa',
};
const affected: Record<string, string[]> = {
  error_spike: ['edge-functions', 'replicate'], slow_processing: ['edge-functions', 'replicate'],
  high_usage: ['database', 'edge-functions'], api_error: ['replicate'],
};
export function toIncident(alert: { id: string; type: string; severity: string; created_at: string; message: string }): Incident {
  return {
    id: alert.id, title: titles[alert.type] || 'Incidente Detectado', status: 'investigating',
    severity: alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'major' : 'minor',
    createdAt: new Date(alert.created_at), affectedServices: affected[alert.type] || ['edge-functions'], message: alert.message,
  };
}
