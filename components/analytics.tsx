'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
const ids=new Set(['demo','upload','sample_download','sandbox_toggle','start_keys_toggle','start_upload_toggle','sandbox_demo','sandbox_connect','sandbox_disconnect','sandbox_find_keys','question_cost','question_ads','question_unknown_cost','question_no_ads','question_continue','question_skip','read_add_costs','read_math','read_top_leak','read_plan','leak_answer','leak_plan','leak_reminder','leak_help','leak_draft','draft_field','plan_top_leak','plan_reminder','reminder_approve','reminder_cancel','reminder_stop','reminder_back','reminder_email','reminder_submit','privacy_link','terms_link','refunds_link','source_link','analytics_toggle','back_link','math_close','nav_home','nav_chat','nav_workspace','nav_connect','nav_billing','chat_ask','chat_demo','chat_suggestion','chat_cost_interview','chat_voice','chat_clarify','chat_interpret','chat_evidence','workspace_reminder_add','workspace_reminder_toggle','workspace_export','workspace_delete','workspace_save','workspace_share','workspace_assistant_access','workspace_assistant_labels','account_signin','account_signout','billing_checkout','billing_manage','connect_home','connect_workspace','connect_claude_help','connect_plugin_download','connect_codex_help','connect_csv']);
const key='scale_analytics_consent';
declare global {interface Window {dataLayer:unknown[];gtag:(...args:unknown[])=>void}}
export default function Analytics(){
 const path=usePathname();
 const [consent,setConsent]=useState(false),[available,setAvailable]=useState(false);
 useEffect(()=>{if(location.hostname!=='app.willthiseverscale.com'||location.protocol!=='https:')return;setAvailable(true);setConsent(localStorage.getItem(key)==='yes');},[]);
 useEffect(()=>{if(!available||!consent)return;
  window.dataLayer=window.dataLayer||[];// Google tag expects each command as the function's arguments object.
  window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('js',new Date());window.gtag('config','G-M0SCCVSX59',{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:location.origin+location.pathname,page_referrer:''});
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id=G-M0SCCVSX59';document.head.appendChild(script);
  const track=(event:Event)=>{const target=event.target;if(!(target instanceof Element))return;const button=target.closest('button,input[type=submit]'); if(event.type==='click' && ((button instanceof HTMLButtonElement && button.type==='submit' && button.form)||(button instanceof HTMLInputElement && button.type==='submit' && button.form))) return; const field=target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement; if((event.type==='click'&&field)||(event.type==='change'&&!field))return;const element=target.closest('[data-analytics-id]');const id=element?.getAttribute('data-analytics-id');if(!id||!ids.has(id))return;window.gtag('event',event.type==='submit'?'form_submit':event.type==='change'?'interaction_change':'interaction_click',{element_label:id,page_location:location.origin+location.pathname,page_referrer:''});};
  document.addEventListener('click',track);document.addEventListener('change',track);document.addEventListener('submit',track);
  return()=>{document.removeEventListener('click',track);document.removeEventListener('change',track);document.removeEventListener('submit',track);script.remove();};
 },[available,consent]);
 useEffect(()=>{if(available&&consent&&window.gtag)window.gtag('event','page_view',{page_location:location.origin+path,page_referrer:''});},[available,consent,path]);
 return null;
}
