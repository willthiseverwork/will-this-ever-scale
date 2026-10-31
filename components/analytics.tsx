'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
const ids=new Set(['demo','upload','deposit_percent','period_comparison','choose_suggested_action','sample_download','item_costs','coverage','evidence','sandbox_toggle','sandbox_connect','sandbox_disconnect','assumptions','cost_per_item','ad_spend','small_threshold','fixed_fee','update_numbers','ai_read','answer_reach','answer_new','answer_reason','answer_sets','answer_price','answer_source','choose_test','calendar_download','sandbox_result_link','action_propose','action_approve','action_cancel','privacy_link','source_link','privacy_home','sandbox_connect_form','sandbox_action_form','sandbox_action_type','sandbox_invoice_id','sandbox_recipient','sandbox_product_name','sandbox_description','sandbox_amount','sandbox_currency','sandbox_interval','reminder_form','reminder_email','reminder_consent']);
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
 if(!available)return null;
 const change=(value:boolean)=>{localStorage.setItem(key,value?'yes':'no');setConsent(value);if(!value)location.reload();};
 return <aside aria-label="Analytics preference"><p>Optional analytics: {consent?'on':'off'}. <button type="button" onClick={()=>change(!consent)}>{consent?'Turn analytics off':'Allow analytics'}</button> <a href="/privacy" data-analytics-id="privacy_link">Privacy</a></p></aside>;
}
