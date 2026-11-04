'use client';
import {useCallback,useEffect,useState} from 'react';
type Status='loading'|'unconfigured'|'signedout'|'signedin'|'deletionPending'|'error';
const stampKey='wtes-account-refreshed-at';
const renewalMs=4*60*1000;
type Account={configured:boolean;authenticated:boolean;deletionPending?:boolean};
async function account():Promise<Account>{const r=await fetch('/api/account',{cache:'no-store'});if(!r.ok)throw new Error('Account status is temporarily unavailable.');return r.json();}
/** Use an origin-wide browser lock before every rotation; do not risk reuse if unavailable. */
async function lockedRefresh(force:boolean):Promise<'ok'|'signedout'|'unavailable'>{
 if(!navigator.locks)return 'unavailable';
 return navigator.locks.request('wtes-account-refresh',{mode:'exclusive'},async()=>{
  const current=await account();if(!current.configured)return 'unavailable';
  if(!force&&current.authenticated)return 'ok';
  let last=0;try{last=Number(localStorage.getItem(stampKey)||0)}catch{}
  if(force&&current.authenticated&&Date.now()-last<renewalMs-5000)return 'ok';
  const r=await fetch('/api/account/refresh',{method:'POST',cache:'no-store'});
  if(r.ok){try{localStorage.setItem(stampKey,String(Date.now()))}catch{}return 'ok';}
  return r.status===401?'signedout':'unavailable';
 });
}
export function useAccountSession(options:{passive?:boolean}={}){
 const [status,setStatus]=useState<Status>('loading'),[error,setError]=useState('');
 const refresh=useCallback(async()=>{try{const first=await account();if(!first.configured){setStatus('unconfigured');setError('');return}if(first.authenticated){setStatus(first.deletionPending?'deletionPending':'signedin');setError('');return}const outcome=await lockedRefresh(false);if(outcome==='ok'){const after=await account();setStatus(after.authenticated?(after.deletionPending?'deletionPending':'signedin'):'signedout');setError('');}else if(outcome==='signedout'){setStatus('signedout');setError('');}else{setStatus('error');setError('Session renewal is temporarily unavailable.');}}catch{setStatus('error');setError('Account status is temporarily unavailable.');}},[]);
 const ensureSession=useCallback(async()=>{
  try{
   if(!navigator.locks){setError('Session renewal is unavailable. Please try again.');return false;}
   const started=Date.now();
   const result=await navigator.locks.request('wtes-account-refresh',{mode:'exclusive'},async()=>{
    let last=0;try{last=Number(localStorage.getItem(stampKey)||0)}catch{}
    if(last>started&&(await account()).authenticated)return 'ok';
    const response=await fetch('/api/account/refresh',{method:'POST',cache:'no-store'});
    if(response.ok){try{localStorage.setItem(stampKey,String(Date.now()))}catch{}return 'ok';}
    return response.status===401?'signedout':'unavailable';
   });
   if(result==='signedout'){setStatus('signedout');setError('Please sign in again.');return false;}
   if(result==='unavailable'){setError('Session renewal is temporarily unavailable. Please try again.');return false;}
   setError('');return true;
  }catch{setError('Session renewal is temporarily unavailable. Please try again.');return false;}
 },[]);
 useEffect(()=>{if(!options.passive){void refresh();return}let alive=true;void account().then(value=>{if(alive)setStatus(!value.configured?'unconfigured':value.authenticated?(value.deletionPending?'deletionPending':'signedin'):'signedout')}).catch(()=>{if(alive){setStatus('error');setError('Account status is temporarily unavailable.')}});return()=>{alive=false}},[refresh,options.passive]);
 useEffect(()=>{if(options.passive||status!=='signedin'&&status!=='deletionPending')return;let alive=true;const renew=async()=>{try{const outcome=await lockedRefresh(true);if(!alive)return;if(outcome==='signedout'){setStatus('signedout');setError('');}else if(outcome==='unavailable'){setError('Automatic session renewal is unavailable. Your current session may expire.');}else setError('');}catch{if(alive)setError('Automatic session renewal is unavailable. Your current session may expire.');}};void renew();const timer=window.setInterval(()=>void renew(),renewalMs);const visible=()=>{if(document.visibilityState==='visible')void renew()};document.addEventListener('visibilitychange',visible);return()=>{alive=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible)}},[status,options.passive]);
 return {status,error,refresh,ensureSession};
}
