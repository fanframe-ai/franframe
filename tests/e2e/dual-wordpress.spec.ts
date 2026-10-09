import { test, expect } from '@playwright/test';
const production='https://tricolorvirtualexperience.net';
const homolog='https://spfc.virtualfans.com.br';
for(const mismatch of [false,true])test(`production handoff ${mismatch?'rejects homolog session fallback':'uses source-specific checkout'}`,async({page})=>{
  if (!mismatch) await page.addInitScript(()=>{ Object.defineProperty(AbortSignal,'any',{value:undefined}); Object.defineProperty(AbortSignal,'timeout',{value:undefined}); });
  await page.route('**/rest/v1/teams?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'11111111-1111-4111-8111-111111111111',slug:'testteam',name:'Time de Teste',is_active:true,shirts:[],backgrounds:[],tutorial_assets:{},text_overrides:{},purchase_urls:{credits1:`${homolog}/checkout/`}})}));
  await page.addInitScript(()=>{localStorage.setItem('vf_app_token:testteam','saved-homolog');localStorage.setItem('vf_wp_origin:testteam','https://spfc.virtualfans.com.br');});
  await page.route('**/functions/v1/fanframe-proxy',route=>{
    const body=route.request().postDataJSON();
    if(body.action==='exchange'){
      expect(body.wordpress_origin).toBe(production);
      if(mismatch)return route.fulfill({status:401,contentType:'application/json',body:'{"error":"invalid_code"}'});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,app_token:'production-session',balance:0,wordpress_origin:mismatch?homolog:production,purchase_urls:{credits1:`${production}/checkout/?add-to-cart=4516`,price1:'R$ 5,90'}})});
  });
  await page.goto(`/testteam?code=fixture-code&wordpress_origin=${encodeURIComponent(production)}`);
  if(mismatch){await expect(page.getByRole('heading',{name:'Acesso Restrito'})).toBeVisible();await expect(page.getByRole('button',{name:'EXPERIMENTAR AGORA'})).toHaveCount(0);}
  else{
    await page.getByRole('button',{name:'EXPERIMENTAR AGORA'}).click();
    await expect(page.getByRole('heading',{name:'Sem créditos'})).toBeVisible();
    await expect(page.getByRole('link',{name:'Comprar'})).toHaveAttribute('href',`${production}/checkout/?add-to-cart=4516`);
    await expect(page.getByText('R$ 5,90',{exact:true})).toBeVisible();
  }
});
