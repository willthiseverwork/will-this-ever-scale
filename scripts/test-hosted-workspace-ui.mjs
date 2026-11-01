// Run against an explicitly selected hosted deployment; all account API calls are mocked.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const base=process.env.WTES_HOSTED_TEST_URL;
if(!base||new URL(base).protocol!=='https:')throw new Error('Set WTES_HOSTED_TEST_URL to the HTTPS deployment under test.');
const browser=await chromium.launch({headless:true,...(process.env.WTES_TEST_CHROME_PATH?{executablePath:process.env.WTES_TEST_CHROME_PATH}:{})});
try{
 const page=await browser.newPage();
 let signedIn=true, deletionPending=false, workspaceMode='pending', writes=0, workspaceReads=0;
 let workspace={revision:0,settings:{shareWorkspaceWithAssistant:false,shareProductNamesWithAssistant:false},snapshots:[],reminders:[],tests:[],trialStartedAt:null,trialEndsAt:null};
 const changes=[];
 await page.route('**/api/account',route=>route.fulfill({json:{configured:true,authenticated:signedIn,...(deletionPending?{deletionPending:true}:{trial:null})}}));
 await page.route('**/api/account/refresh',route=>route.fulfill({status:401,json:{error:'Sign in required.'}}));
 await page.route('**/api/account/logout',route=>{signedIn=false;return route.fulfill({status:503,json:{ok:false,error:'Signed out locally; provider session revocation could not be confirmed.'}})});
 await page.route('**/api/workspace',async route=>{
  if(route.request().method()!=='GET'){writes++;if(route.request().method()!=='PUT')return route.fulfill({status:500});const input=route.request().postDataJSON();changes.push(input);workspace={...workspace,...input,revision:input.revision+1};return route.fulfill({json:{workspace}});}
  workspaceReads++;if(workspaceMode==='pending')return;
  if(workspaceMode==='fail')return route.fulfill({status:503,json:{error:'Workspace unavailable.'}});
  return route.fulfill({json:{workspace}});
 });
 await page.goto(new URL('/workspace',base).href,{waitUntil:'domcontentloaded'});
 const add=page.getByRole('button',{name:'Save reminder'});
 await page.getByText('Account reminders are unavailable until your workspace loads.').waitFor();
 assert.equal(await add.isDisabled(),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('wtes-local-reminders-v1')),null);
 workspaceMode='fail';await page.reload({waitUntil:'domcontentloaded'});
 await page.getByText('Your workspace could not be loaded.').waitFor();
 assert.equal(await add.isDisabled(),true);
 assert.equal(writes,0);
 workspaceMode='success';await page.reload({waitUntil:'domcontentloaded'});
 await page.getByText('Saved to your account.',{exact:false}).waitFor();
 assert.equal(await add.isEnabled(),true);
 assert.equal(writes,0,'No workspace mutation before explicit interaction');
 const access=page.getByRole('checkbox',{name:'Allow connected Claude Code and Codex assistants to access my saved summaries'});
 const labels=page.getByRole('checkbox',{name:'Also allow reviewed product labels to be shared with a connected assistant'});
 assert.equal(await access.isChecked(),false);assert.equal(await labels.isChecked(),false);
 for(const [viewport,width,height] of [['desktop',1440,900],['mobile',375,812]]){
  await page.setViewportSize({width,height});
  const errors=[];const onError=error=>errors.push(error.message);const onConsole=message=>{if(message.type()==='error')errors.push(message.text())};
  page.on('pageerror',onError);page.on('console',onConsole);
  await page.reload({waitUntil:'networkidle'});await access.waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`${viewport} horizontal overflow`);
  if(process.env.WTES_TEST_OUTPUT_DIR){await mkdir(process.env.WTES_TEST_OUTPUT_DIR,{recursive:true});await page.locator('section').filter({has:access}).screenshot({path:join(process.env.WTES_TEST_OUTPUT_DIR,`workspace-consent-${viewport}.png`)});}
  assert.deepEqual(errors,[],`${viewport} console or page errors`);page.off('pageerror',onError);page.off('console',onConsole);
 }
 assert.equal(writes,0,'Viewport checks do not mutate workspace');
 await access.focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('[data-analytics-id="workspace_assistant_access"]:checked'));
 assert.deepEqual(changes[0].settings,{shareWorkspaceWithAssistant:true,shareProductNamesWithAssistant:false});
 await labels.focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('[data-analytics-id="workspace_assistant_labels"]:checked'));
 assert.deepEqual(changes[1].settings,{shareWorkspaceWithAssistant:true,shareProductNamesWithAssistant:true});
 await access.focus();await page.keyboard.press('Space');await page.waitForFunction(()=>{const el=document.querySelector('[data-analytics-id="workspace_assistant_access"]');return el&&!el.checked});
 assert.deepEqual(changes[2].settings,{shareWorkspaceWithAssistant:false,shareProductNamesWithAssistant:true});
 assert.equal(await labels.isChecked(),true);assert.equal(writes,3);
 await page.getByRole('button',{name:'Sign out'}).click();
 await page.getByText('Signed out locally, but provider session revocation could not be confirmed.').waitFor();
 assert.equal(await page.getByRole('link',{name:'Sign in',exact:true}).count(),1);
 assert.equal(writes,3);
 signedIn=true;deletionPending=true;const readsBeforePending=workspaceReads;
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Account deletion pending'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Save reminder'}).count(),0);
 assert.equal(workspaceReads,readsBeforePending,'Pending state must not fetch workspace');
 const retry=page.getByRole('button',{name:'Permanently delete account'});
 if(await retry.count())assert.equal(await retry.isDisabled(),true,'Retry requires typed confirmation');
 else await page.getByText('Account deletion needs the service owner to finish.',{exact:false}).waitFor();
 assert.equal(writes,3);
 console.log('Hosted workspace UI failure-state, consent, and deletion-pending reload checks passed (mocked account APIs).');
}finally{await browser.close();}
