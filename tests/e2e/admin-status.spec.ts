import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  const user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',aud:'authenticated',role:'authenticated',email:'admin@example.com',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
  await page.route('**/rest/v1/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.route('**/rest/v1/user_roles?**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"role":"admin"}'}));
  await page.route('**/auth/v1/token?grant_type=password',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'admin-fixture',token_type:'bearer',expires_in:3600,refresh_token:'refresh-fixture',user})}));
  await page.route('**/rest/v1/rpc/admin_generation_stats',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({totals:{total:42,success:40,failed:2,avg_time:75000,unique_users:31},hourly:[],daily:[],shirts:[],cost_cents:378})}));
  await page.route('**/rest/v1/rpc/generation_operations',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({controls:{admissions_paused:false,dispatch_paused:false,event_budget_cents:30000,daily_budget_cents:30000,margin_percent:10,max_active:1,max_waiting:3,starts_per_minute:6,worker_seen_at:new Date().toISOString()},waiting:0,active:0,uncertain:0,saving:0,awaiting_payment:0,reserved_cents:0,spent_cents:378,recent_completed:0,recent_failed:0,p95_total_seconds:null,p95_save_seconds:null})}));
  await page.goto('/admin/login');await page.getByLabel('Email').fill('admin@example.com');await page.getByLabel('Senha').fill('fixture-password');await page.getByRole('button',{name:'Entrar'}).click();await expect(page).toHaveURL(/\/admin$/);
}
function snapshot(age=0) {
  const created_at=new Date(Date.now()-age).toISOString();
  const ids=['database','auth','edge-functions','realtime','replicate','cdn'];
  return {observed_at:created_at,latest:ids.map(service_id=>({service_id,status:'operational',response_time_ms:service_id==='database'?0:200,created_at,error_message:null,run_id:null})),stats:ids.map(service_id=>({service_id,checked:1,available:service_id==='database'?0:1,unknown_checks:0,availability:service_id==='database'?0:100,since:created_at})),days:[]};
}
test('status preserves zero metrics, expires old evidence and handles refresh failures honestly',async({page})=>{
  await login(page);let fail=false;let old=false;
  await page.route('**/rest/v1/rpc/system_status_snapshot',route=>route.fulfill({status:fail?503:200,contentType:'application/json',body:fail?'{}':JSON.stringify(snapshot(old?8*60000:0))}));
  await page.goto('/admin/status');await expect(page.getByRole('heading',{name:'Todos os serviços verificados estão acessíveis'})).toBeVisible();
  await expect(page.getByText('0ms',{exact:true})).toBeVisible();await expect(page.getByText('0%',{exact:true}).first()).toBeVisible();
  old=true;await page.reload();await expect(page.getByRole('heading',{name:'Status sem confirmação recente'})).toBeVisible();
  fail=true;await page.reload();await expect(page.getByRole('alert').filter({hasText:'Não foi possível atualizar'})).toBeVisible();await expect(page.getByRole('heading',{name:'Sistemas fora do ar'})).toHaveCount(0);
});
test('manual check only succeeds after persistence, then refreshes the snapshot',async({page})=>{
  await login(page);let saved=false;
  await page.route('**/rest/v1/rpc/system_status_snapshot',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot(saved?0:8*60000))}));
  await page.route('**/functions/v1/health-check',route=>{saved=true;return route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"persisted":true}'});});
  await page.goto('/admin/status');await expect(page.getByRole('heading',{name:'Status sem confirmação recente'})).toBeVisible();
  await page.getByRole('button',{name:'Verificar Agora'}).click();await expect(page.getByRole('heading',{name:'Todos os serviços verificados estão acessíveis'})).toBeVisible();
  await page.route('**/functions/v1/health-check',route=>route.fulfill({status:503,contentType:'application/json',body:'{"success":false,"persisted":false,"error":"health_persistence_failed"}'}));
  await page.getByRole('button',{name:'Verificar Agora'}).click();await expect(page.getByText('Não foi possível concluir a verificação',{exact:true})).toBeVisible();
});
for(const width of [390,1440])test(`admin layout at ${width}px retains usable navigation and bounded content`,async({page},testInfo)=>{
  if (width === 390) await page.addInitScript(()=>{ Object.defineProperty(AbortSignal,'any',{value:undefined}); Object.defineProperty(AbortSignal,'timeout',{value:undefined}); });
  await page.setViewportSize({width,height:1000});await login(page);
  if(width<1024){await page.getByRole('button',{name:'Abrir navegação'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('link',{name:'Status',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
  await page.route('**/rest/v1/rpc/system_status_snapshot',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot())}));
  await page.goto('/admin/status');await expect(page.getByRole('heading',{name:'Todos os serviços verificados estão acessíveis'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`status-${width}.png`),fullPage:true});
  await page.goto('/admin');await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
  await expect(page.getByText('Custo por geração 2K: US$ 0,09.',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`dashboard-${width}.png`),fullPage:true});
});
