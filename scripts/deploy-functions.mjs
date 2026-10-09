import { spawnSync } from 'node:child_process';

const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef)) {
  console.error('Defina SUPABASE_PROJECT_REF com o ref de 20 caracteres do projeto destino.');
  process.exit(2);
}
const names = ['fanframe-proxy', 'generate-tryon', 'replicate-webhook', 'generation-status', 'generation-worker', 'health-check', 'create-first-admin'];
const result = spawnSync('supabase', ['functions', 'deploy', ...names, '--project-ref', projectRef, '--import-map', 'supabase/functions/deno.json', '--use-api'], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
