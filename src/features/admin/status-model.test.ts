import { describe, expect, it } from 'vitest';
import { buildUptimeHistory, overallStatus, toIncident } from './status-model';

describe('system status calculations', () => {
  it('uses the worst service state', () => {
    expect(overallStatus(['operational', 'major_outage'])).toBe('major_outage');
    expect(overallStatus(['operational', 'unknown'])).toBe('unknown');
    expect(overallStatus(['operational', 'operational'])).toBe('operational');
  });
  it('keeps history separated by service and maps incident ownership', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    const history = buildUptimeHistory(['database', 'replicate'], [
      { service_id: 'database', status: 'operational', created_at: now.toISOString() },
      { service_id: 'replicate', status: 'major_outage', created_at: now.toISOString() },
    ], now);
    expect(history.database.at(-1)?.status).toBe('operational');
    expect(history.replicate.at(-1)?.status).toBe('major_outage');
    expect(history.database[0].status).toBe('unknown');
    expect(toIncident({ id: '1', type: 'api_error', severity: 'critical', created_at: now.toISOString(), message: 'error' }).affectedServices).toEqual(['replicate']);
  });
});
