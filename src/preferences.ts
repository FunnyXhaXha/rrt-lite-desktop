import type { Language } from './prompts';
export type Theme = 'light' | 'dark' | 'system';
export function initialLanguage(): Language {
 try { const saved=localStorage.getItem('rrt-lite.language'); if(saved==='en'||saved==='zh') return saved; } catch {}
 return (navigator.language||'en').toLowerCase().startsWith('zh')?'zh':'en';
}
export function initialTheme(): Theme { try {const t=localStorage.getItem('rrt-lite.theme');if(t==='light'||t==='dark')return t;}catch{} return 'system'; }
export function savePreference(key:'language'|'theme',value:string){try{localStorage.setItem('rrt-lite.'+key,value);}catch{/* Preferences are optional; input stays in memory. */}}
