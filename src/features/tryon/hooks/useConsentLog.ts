import { useTeam } from '@/features/teams/TeamContext';
import { credentials, invoke } from '@/integrations/supabase/functions';
export const CONSENT_TEXT = 'Declaro que sou o titular da imagem ou possuo autorização das pessoas nela presentes, que a imagem não contém conteúdo ilegal, ofensivo ou impróprio, e que será utilizada para gerar uma foto com a camisa oficial do clube. Assumo total responsabilidade por seu uso, isentando a Virtual Fans e o clube, e concordo com o Termo de Uso.';
export function useConsentLog() {
  const { team } = useTeam();
  const logConsent = async () => {
    if (!team) return false;
    try { await invoke('fanframe-proxy', { ...credentials(team.slug), action: 'consent' }); return true; }
    catch { return false; }
  };
  return { logConsent, CONSENT_TEXT };
}
