import { describe, expect, it } from 'vitest';
import { buildUptimeHistory, buildAggregatedHistory, currentStatus, overallStatus, toIncident } from './status-model';

describe('system status calculations', () => {
  it('does not label budget or worker alerts as provider outages', () => {
    const base={id:'1',type:'api_error',severity:'warning',created_at:'2026-10-09T12:00:00Z',message:'exposure'};
    expect(toIncident({...base,operation_key:'budget_70'}).affectedServices).toEqual([]);
    expect(toIncident({...base,operation_key:'budget_70'}).title).toContain('70%');
    expect(toIncident({...base,operation_key:'worker_stale'}).affectedServices).toEqual(['edge-functions']);
  });
  it('allows schedule slack but rejects expired, future and invalid observations', () => {
    const now = Date.parse('2026-10-09T12:00:00Z');
    expect(currentStatus('operational',new Date(now-6*60000).toISOString(),now)).toBe('operational');
    expect(currentStatus('major_outage',new Date(now-8*60000).toISOString(),now)).toBe('unknown');
    expect(currentStatus('wrong','2026-10-09T12:00:00Z',now)).toBe('unknown');
    expect(currentStatus('operational','bad date',now)).toBe('unknown');
    expect(currentStatus('operational',new Date(now+120000).toISOString(),now)).toBe('unknown');
  });
  it('keeps unknown gaps neutral and respects Brazil midnight', () => {
    const today=new Date('2026-10-09T12:00:00Z');
    const history=buildUptimeHistory(['auth'],[{service_id:'auth',status:'operational',created_at:'2026-10-09T02:59:00Z'},{service_id:'auth',status:'degraded',created_at:'2026-10-09T03:01:00Z'}],today);
    expect(history.auth.at(-2)?.status).toBe('operational');expect(history.auth.at(-1)?.status).toBe('degraded');
    const aggregated=buildAggregatedHistory(['auth'],[{service_id:'auth',date:'2026-10-09',checks:1501,operational:0,available:1500,degraded:1500,failed:0,unknown_checks:1}],today);
    expect(aggregated.auth.at(-1)?.status).toBe('degraded');expect(aggregated.auth.at(-1)?.checks).toBe(1501);
  });
  it('never turns successful but degraded samples into a full outage', () => {
    const now = new Date('2026-10-09T12:00:00Z');
    const history = buildUptimeHistory(['auth'], Array.from({ length: 10 }, () => ({ service_id: 'auth', status: 'degraded', created_at: now.toISOString() })), now);
    expect(history.auth.at(-1)?.status).toBe('degraded');
  });
  it('uses the worst service state', () => {
    expect(overallStatus(['operational', 'major_outage'])).toBe('partial_outage');
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
