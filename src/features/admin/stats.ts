export interface AggregateStats {
  totals: { total: number; success: number; failed: number; avg_time: number; unique_users: number };
  hourly: { hour: number; count: number; success: number; failed: number }[];
  daily: { date: string; total: number; success: number; failed: number }[];
  shirts: { name: string; value: number }[];
  cost_cents: number;
}
export interface GenerationOperations {
  controls: { admissions_paused: boolean; dispatch_paused: boolean; event_budget_cents: number; daily_budget_cents: number; margin_percent: number; max_active: number; max_waiting: number; starts_per_minute: number; worker_seen_at: string | null };
  waiting: number; active: number; uncertain: number; saving: number; awaiting_payment: number;
  reserved_cents: number; spent_cents: number; oldest_waiting_at: string | null; oldest_output_at: string | null;
  recent_completed: number; recent_failed: number; p95_total_seconds: number | null; p95_save_seconds: number | null;
}
export function brazilDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
