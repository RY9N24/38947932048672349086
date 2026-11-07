"use client";
import {useEffect,useState} from 'react';
export function toast(message: unknown) {
  if(typeof message !== 'string' || !message.trim()) return;
  window.dispatchEvent(new CustomEvent('fairround-notice',{detail:message.trim()}));
}
export function Notifications(){
  const [message,setMessage]=useState('');
  useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const receive=(event:Event)=>{const text=(event as CustomEvent).detail;if(typeof text!=='string'||!text.trim())return;setMessage(text);clearTimeout(timer);timer=setTimeout(()=>setMessage(''),5000);};window.addEventListener('fairround-notice',receive);return()=>{window.removeEventListener('fairround-notice',receive);clearTimeout(timer);};},[]);
  return message ? <div className="protocol-notice" role="status"><span>{message}</span><button aria-label="Закрыть уведомление" onClick={()=>setMessage('')}>×</button></div> : null;
}
