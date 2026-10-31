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
export function useAccountSession(){
 const [status,setStatus]=useState<Status>('loading'),[error,setError]=useState('');
 const refresh=useCallback(async()=>{try{const first=await account();if(!first.configured){setStatus('unconfigured');setError('');return}if(first.authenticated){setStatus(first.deletionPending?'deletionPending':'signedin');setError('');return}const outcome=await lockedRefresh(false);if(outcome==='ok'){const after=await account();setStatus(after.authenticated?(after.deletionPending?'deletionPending':'signedin'):'signedout');setError('');}else if(outcome==='signedout'){setStatus('signedout');setError('');}else{setStatus('error');setError('Session renewal is temporarily unavailable.');}}catch{setStatus('error');setError('Account status is temporarily unavailable.');}},[]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{if(status!=='signedin'&&status!=='deletionPending')return;let alive=true;const renew=async()=>{try{const outcome=await lockedRefresh(true);if(!alive)return;if(outcome==='signedout'){setStatus('signedout');setError('');}else if(outcome==='unavailable'){setError('Automatic session renewal is unavailable. Your current session may expire.');}else setError('');}catch{if(alive)setError('Automatic session renewal is unavailable. Your current session may expire.');}};const timer=window.setInterval(()=>void renew(),renewalMs);const visible=()=>{if(document.visibilityState==='visible')void renew()};document.addEventListener('visibilitychange',visible);return()=>{alive=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible)}},[status]);
 return {status,error,refresh};
}
