// Run against an explicitly selected hosted deployment; all account API calls are mocked.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.WTES_HOSTED_TEST_URL;
if(!base||new URL(base).protocol!=='https:')throw new Error('Set WTES_HOSTED_TEST_URL to the HTTPS deployment under test.');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 let signedIn=true, workspaceMode='pending', writes=0;
 await page.route('**/api/account',route=>route.fulfill({json:{configured:true,authenticated:signedIn,trial:null}}));
 await page.route('**/api/account/refresh',route=>route.fulfill({status:401,json:{error:'Sign in required.'}}));
 await page.route('**/api/account/logout',route=>{signedIn=false;return route.fulfill({status:503,json:{ok:false,error:'Signed out locally; provider session revocation could not be confirmed.'}})});
 await page.route('**/api/workspace',async route=>{
  if(route.request().method()!=='GET'){writes++;return route.fulfill({status:500});}
  if(workspaceMode==='pending')return;
  if(workspaceMode==='fail')return route.fulfill({status:503,json:{error:'Workspace unavailable.'}});
  return route.fulfill({json:{workspace:{revision:0,settings:{shareProductNamesWithAssistant:false},snapshots:[],reminders:[],tests:[],trialStartedAt:null,trialEndsAt:null}}});
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
 await page.getByRole('button',{name:'Sign out'}).click();
 await page.getByText('Signed out locally, but provider session revocation could not be confirmed.').waitFor();
 assert.equal(await page.getByRole('link',{name:'Sign in',exact:true}).count(),1);
 assert.equal(writes,0);
 console.log('Hosted workspace UI failure-state checks passed (mocked account APIs).');
}finally{await browser.close();}
