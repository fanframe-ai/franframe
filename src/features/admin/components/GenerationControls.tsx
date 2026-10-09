import { useCallback, useEffect, useState } from 'react';
import { Pause, Play, Save, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import type { GenerationOperations } from '@/features/admin/stats';
export function GenerationControls({ teamId }: { teamId: string | null }) {
  const [operations, setOperations] = useState<GenerationOperations | null>(null);
  const [slots, setSlots] = useState(20); const [eventBudget, setEventBudget] = useState(300); const [dailyBudget, setDailyBudget] = useState(300);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('generation_operations', { p_team: teamId || undefined });
    if (error) { setError('Não foi possível consultar a operação.'); return; }
    setError(null); setOperations(data as unknown as GenerationOperations);
  }, [teamId]);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 15000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => { if (operations) { setSlots(operations.controls.max_active); setEventBudget(operations.controls.event_budget_cents / 100); setDailyBudget(operations.controls.daily_budget_cents / 100); } }, [operations?.controls.max_active, operations?.controls.event_budget_cents, operations?.controls.daily_budget_cents]); // eslint-disable-line react-hooks/exhaustive-deps
  async function configure(settings: Record<string, number | boolean>) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('configure_generation_controls', { p_scope: 'global', p_settings: settings });
      if (error) throw error;
      await refresh(); toast({ title: 'Operação atualizada' });
    } catch { toast({ title: 'Não foi possível atualizar a operação', variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  const control = operations?.controls;
  const stale = !control?.worker_seen_at || Date.now() - Date.parse(control.worker_seen_at) > 60000;
  return <section className="border-y border-border py-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold">Operação de gerações · limites globais</h2>
      <Button size="icon" variant="ghost" title="Atualizar operação" aria-label="Atualizar operação" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /></Button>
    </div>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {operations && <>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
        {Object.entries({ 'Na fila': operations.waiting, 'Em execução': operations.active, 'Salvando': operations.saving, 'Aguardando crédito': operations.awaiting_payment, 'Reservado': `$${(operations.reserved_cents / 100).toFixed(2)}`, 'Gasto estimado': `$${(operations.spent_cents / 100).toFixed(2)}` }).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-bold mt-1">{value}</dd></div>)}
      </dl>
      {operations.uncertain > 0 && <p role="alert" className="text-destructive text-sm">{operations.uncertain} envio(s) incerto(s). Verifique no provedor antes de repetir.</p>}
      <p className="text-sm text-muted-foreground">Últimos 5 minutos: {operations.recent_completed} prontas, {operations.recent_failed} falhas após envio. p95 total: {operations.p95_total_seconds == null ? 'sem amostra' : `${Math.round(operations.p95_total_seconds)}s`}. p95 para salvar: {operations.p95_save_seconds == null ? 'sem amostra' : `${Math.round(operations.p95_save_seconds)}s`}.</p>
      <p className={`text-sm ${stale ? 'text-warning' : 'text-muted-foreground'}`}>Worker: {stale ? 'sem atualização recente' : 'ativo'}{control?.worker_seen_at ? ` · ${new Date(control.worker_seen_at).toLocaleTimeString('pt-BR')}` : ''}. Reserva de segurança: {control?.margin_percent}%.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Fotos simultâneas<Input type="number" min={1} max={100} value={slots} onChange={event => setSlots(Number(event.target.value))} className="w-32 mt-1" /></label>
        <label className="text-sm">Teto do evento (US$)<Input type="number" min={1} value={eventBudget} onChange={event => setEventBudget(Number(event.target.value))} className="w-40 mt-1" /></label>
        <label className="text-sm">Teto diário (US$)<Input type="number" min={1} value={dailyBudget} onChange={event => setDailyBudget(Number(event.target.value))} className="w-40 mt-1" /></label>
        <Button disabled={busy || !Number.isInteger(slots) || slots < 1 || slots > 100 || !Number.isFinite(eventBudget) || !Number.isFinite(dailyBudget) || eventBudget <= 0 || dailyBudget <= 0 || eventBudget > 300000 || dailyBudget > 300000} onClick={() => void configure({ max_active: slots, event_budget_cents: Math.round(eventBudget * 100), daily_budget_cents: Math.round(dailyBudget * 100), starts_per_minute: Math.min(120, Math.ceil(slots * 1.5)) })}><Save className="h-4 w-4 mr-2" />Salvar limites</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={busy} variant="outline" onClick={() => void configure({ admissions_paused: !control?.admissions_paused })}>{control?.admissions_paused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}{control?.admissions_paused ? 'Retomar pedidos' : 'Pausar pedidos'}</Button>
        <Button disabled={busy} variant="outline" onClick={() => void configure({ dispatch_paused: !control?.dispatch_paused })}>{control?.dispatch_paused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}{control?.dispatch_paused ? 'Retomar processamento' : 'Pausar processamento'}</Button>
      </div>
    </>}
  </section>;
}
