import {useEffect,useRef,useState} from 'react';
import {writeText} from '@tauri-apps/plugin-clipboard-manager';
import {generatePrompt,focuses,targets,toggleFocus,type Focus,type Language,type Target} from './prompts';
import {initialLanguage,initialTheme,savePreference,type Theme} from './preferences';
import {ui} from './i18n';

export function App(){
 const [language,setLanguage]=useState<Language>(initialLanguage);
 const [theme,setTheme]=useState<Theme>(initialTheme);
 const [target,setTarget]=useState<Target>('game');
 const [focus,setFocus]=useState<Focus[]>(['full']);
 const [context,setContext]=useState('');
 const [generated,setGenerated]=useState(false);
 const [error,setError]=useState(false);
 const [copyStatus,setCopyStatus]=useState<'idle'|'copied'|'failed'>('idle');
 const [about,setAbout]=useState(false);
 const inputRef=useRef<HTMLTextAreaElement>(null), outputRef=useRef<HTMLTextAreaElement>(null), dialogRef=useRef<HTMLDialogElement>(null);
 const revision=useRef(0);
 const t=ui[language];
 const output=generated?generatePrompt({language,target,focus,context}):'';
 useEffect(()=>{document.documentElement.lang=language==='zh'?'zh-CN':'en';savePreference('language',language);},[language]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;savePreference('theme',theme);},[theme]);
 useEffect(()=>{revision.current++;setCopyStatus('idle');},[output]);
 useEffect(()=>{if(copyStatus!=='idle'){const timer=setTimeout(()=>setCopyStatus('idle'),2400);return()=>clearTimeout(timer);}},[copyStatus]);
 useEffect(()=>{if(about)dialogRef.current?.showModal();else dialogRef.current?.close();},[about]);
 const invalidate=()=>{setGenerated(false);setCopyStatus('idle');revision.current++;};
 async function copy(){const version=revision.current;try{await writeText(output);if(version===revision.current)setCopyStatus('copied');}catch{if(version===revision.current){setCopyStatus('failed');outputRef.current?.focus();outputRef.current?.select();}}}
 function clear(){setContext('');invalidate();setError(false);inputRef.current?.focus();}
 return <div className="app">
  <header><div className="identity"><span className="monogram">RRT</span><div><h1>RRT Lite</h1><p>{t.subtitle}</p></div></div><div className="header-controls"><div className="language" aria-label={language==='zh'?'语言':'Language'}><button type="button" onClick={()=>setLanguage('zh')} aria-pressed={language==='zh'} lang="zh">中文</button><button type="button" onClick={()=>setLanguage('en')} aria-pressed={language==='en'} lang="en">EN</button></div><button className="quiet" onClick={()=>setAbout(true)}>{t.about}</button></div></header>
  <main><div className="cycle" aria-label={t.cycle}><span>Resource<sub>t</sub></span><b>→</b><span>Decision</span><b>→</b><span>Redemption</span><b>→</b><span>Resource<sub>t+1</sub></span><span className="edition">LITE · 0.1</span></div>
   <div className="workspace"><form onSubmit={e=>{e.preventDefault();if(!context.trim()){setError(true);inputRef.current?.focus();return;}setGenerated(true);setError(false);}}>
    <fieldset><legend><small>01</small>{t.target}</legend><div className="chips">{targets.map(k=><button type="button" key={k} aria-pressed={target===k} onClick={()=>{setTarget(k);invalidate();}}>{t.targets[k]}</button>)}</div></fieldset>
    <fieldset><legend><small>02</small>{t.focus}</legend><div className="chips">{(['full',...focuses] as Focus[]).map(k=><button type="button" key={k} aria-pressed={focus.includes(k)} onClick={()=>{setFocus(toggleFocus(focus,k));invalidate();}}>{t.focuses[k]}</button>)}</div><p className="hint">{t.focusHint}</p></fieldset>
    <label htmlFor="context"><small>03</small>{t.input}</label><textarea aria-label={t.input} id="context" ref={inputRef} value={context} onChange={e=>{setContext(e.target.value);setError(false);invalidate();}} placeholder={t.placeholder} spellCheck={false} autoComplete="off" aria-invalid={error} aria-describedby="input-error"/>
    <p id="input-error" className="error" role="alert">{error?t.required:''}</p><div className="generate-row"><span className="local-note">{t.offline}</span><button type="submit" className="primary">{t.generate}</button></div>
   </form><section className="output" aria-labelledby="output-title"><div className="section-title"><h2 id="output-title">{t.output}</h2><span className="badge">RRT LITE</span></div>
    {output?<textarea ref={outputRef} id="prompt" aria-label={t.output} value={output} readOnly spellCheck={false}/>:<div className="empty"><span>R → D → R</span><h3>{t.empty}</h3><p>{t.emptyHint}</p></div>}
    <div className="actions"><button type="button" className="primary" disabled={!output} onClick={copy}>{t.copy}</button><button type="button" onClick={clear}>{t.clear}</button><span role="status" className="status">{copyStatus==='copied'?t.copied:copyStatus==='failed'?t.copyError:''}</span></div><p className="hint">{t.paste}</p><p className="platforms">ChatGPT · Claude · Gemini · DeepSeek · {t.otherModels}</p></section></div>
   <div className="bottom"><div className="privacy"><strong>{t.offline}</strong><span>{t.privacy}</span></div><label className="theme-label">{t.theme}<select aria-label={t.theme} value={theme} onChange={e=>setTheme(e.target.value as Theme)}>{(['system','light','dark'] as Theme[]).map(k=><option key={k} value={k}>{t.themes[k]}</option>)}</select></label></div>
  </main><footer><span>Xilin Xu</span><span>Discord: badgermunsta</span><span className="footer-note">{t.storage}</span></footer>
  <dialog ref={dialogRef} onCancel={()=>setAbout(false)} onClose={()=>setAbout(false)}><h2>{t.aboutTitle}</h2><p className="about-subtitle">{t.subtitle}</p><p>{t.aboutIntro}</p><p className="about-cycle">Resource → Decision → Redemption → Resource</p><p>{t.contact}</p><p>{t.developed}: <strong>Xilin Xu</strong><br/>Discord: badgermunsta</p><p className="hint">{t.version} 0.1.0 · {t.offline}</p><button className="primary" onClick={()=>setAbout(false)}>{t.close}</button></dialog>
 </div>;
}
