// Runs only in Windows CI/development, never included in the desktop runtime.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const exe=path.resolve(process.argv[2] || 'artifacts/portable/RRT Lite/RRT-Lite.exe');
const runtime=path.join(path.dirname(exe),'WebView2','msedgewebview2.exe');
const rules=['RRT-Lite-CI-App','RRT-Lite-CI-Renderer'];
const ps=(script)=>execFileSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8'});
const quote=s=>"'"+s.replaceAll("'","''")+"'";
let app,browser;
const report={startup:false,chinese:false,english:false,languagePreservation:false,nativeClipboard:false,clear:false,preferencePersistence:false,noInputPersistence:false,externalRequests:[],offline:'Outbound Internet blocked for app and bundled renderer before launch'};
try{
 for(const [i,p] of [exe,runtime].entries())ps(`New-NetFirewallRule -DisplayName '${rules[i]}' -Direction Outbound -Program ${quote(p)} -Action Block -RemoteAddress '0.0.0.0-126.255.255.255','128.0.0.0-255.255.255.255','::/0' | Out-Null`);
 app=spawn(exe,[],{env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1'},stdio:'ignore'});
 for(let i=0;i<60;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9222');break;}catch{await new Promise(r=>setTimeout(r,1000));}}
 if(!browser)throw Error('Native WebView2 did not start');
 const context=browser.contexts()[0];
 const page=context.pages()[0] || await context.waitForEvent('page');
 await page.waitForSelector('#context');report.startup=true;
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!/^https?:\/\/(tauri|ipc)\.localhost\//.test(r.url()))report.externalRequests.push(r.url());});
 await page.getByRole('button',{name:'中文',exact:true}).click();
 const input=page.locator('#context');const zh='我正在设计一个玩家经营商店，通过交易不同物品影响顾客未来状态的游戏。';
 await input.fill(zh);await page.getByRole('button',{name:'生成 RRT Prompt',exact:true}).click();
 assert.match(await page.locator('#prompt').inputValue(),/核心资源结构/);report.chinese=true;
 await page.getByRole('button',{name:'EN',exact:true}).click();assert.equal(await input.inputValue(),zh);
 assert.match(await page.locator('#prompt').inputValue(),/Core Resource Structure/);
 await page.getByRole('button',{name:'中文',exact:true}).click();assert.equal(await input.inputValue(),zh);report.languagePreservation=true;
 await page.getByRole('button',{name:'复制 Prompt',exact:true}).click();await page.getByRole('status').getByText('已复制',{exact:true}).waitFor();
 const clipboard=ps('[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); Get-Clipboard -Raw');assert.ok(clipboard.includes(zh));report.nativeClipboard=true;
 await mkdir('artifacts/qa',{recursive:true});await page.screenshot({path:'artifacts/qa/chinese.png',fullPage:true});
 await page.getByLabel('主题',{exact:true}).selectOption('dark');await page.screenshot({path:'artifacts/qa/chinese-dark.png',fullPage:true});
 await page.getByRole('button',{name:'EN',exact:true}).click();await input.fill('I am designing a survival game where ammunition, time, and information affect whether the player fights or avoids enemies.');
 await page.getByRole('button',{name:'Generate RRT Prompt',exact:true}).click();assert.match(await page.locator('#prompt').inputValue(),/ammunition/);report.english=true;
 await page.getByLabel('Theme',{exact:true}).selectOption('light');await page.screenshot({path:'artifacts/qa/english.png',fullPage:true});
 await page.getByRole('button',{name:'Clear',exact:true}).click();assert.equal(await input.inputValue(),'');assert.equal(await page.locator('#prompt').count(),0);report.clear=true;
 await input.fill('PRIVATE_TEXT_MUST_NOT_PERSIST');
 const keys=await page.evaluate(()=>Object.keys(localStorage));assert.deepEqual(keys.sort(),['rrt-lite.language','rrt-lite.theme']);report.noInputPersistence=true;
 await page.reload();await page.waitForSelector('#context');assert.equal(await input.inputValue(),'');assert.equal(await page.getByLabel('Theme',{exact:true}).inputValue(),'light');report.preferencePersistence=true;
 assert.deepEqual(report.externalRequests,[]);
 console.log(JSON.stringify(report,null,2));
}catch(error){report.error=String(error);throw error;}finally{
 await mkdir('artifacts/qa',{recursive:true});await writeFile('artifacts/qa/native-test-report.json',JSON.stringify(report,null,2));
 if(browser)await browser.close().catch(()=>{});
 if(app?.pid)try{execFileSync('taskkill',['/PID',String(app.pid),'/T','/F']);}catch{}
 for(const rule of rules)try{ps(`Get-NetFirewallRule -DisplayName '${rule}' -ErrorAction SilentlyContinue | Remove-NetFirewallRule`);}catch{}
}
