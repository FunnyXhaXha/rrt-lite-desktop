// Runs only in Windows CI/development, never included in the desktop runtime.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
const exe=path.resolve(process.argv[2] || 'artifacts/portable/RRT Lite/RRT-Lite.exe');
const qaDir=process.argv[3] || 'artifacts/qa';
const reportName=process.argv[4] || 'native-test-report.json';
const ps=(script)=>execFileSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8'});
const listen=(server)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port));});
const close=(server)=>new Promise(resolve=>server.close(resolve));
const reservePort=async()=>{const server=net.createServer();const port=await listen(server);await close(server);return port;};
const userData=path.resolve(qaDir,'.webview-data');
let app,browser,denyProxy;
const report={startup:false,chinese:false,english:false,languagePreservation:false,nativeClipboard:false,clear:false,preferencePersistence:false,noInputPersistence:false,externalRequests:[],proxyAttempts:[],appOutput:[],networkIsolation:'WebView2 forced through a local deny proxy; no OS firewall or network settings changed'};
try{
 await mkdir(userData,{recursive:true});
 denyProxy=net.createServer(socket=>{socket.once('data',data=>report.proxyAttempts.push(data.toString('utf8',0,256).split(/\r?\n/,1)[0]));socket.destroy();});
 const proxyPort=await listen(denyProxy);
 const debugPort=await reservePort();
 const browserArguments=[
  `--remote-debugging-port=${debugPort}`,
  '--remote-debugging-address=127.0.0.1',
  `--proxy-server=http://127.0.0.1:${proxyPort}`,
  '--proxy-bypass-list=<-loopback>;tauri.localhost;ipc.localhost',
  '--disable-quic',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-domain-reliability',
  '--disable-breakpad',
  '--no-first-run'
 ].join(' ');
 app=spawn(exe,[],{env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:browserArguments,WEBVIEW2_USER_DATA_FOLDER:userData},stdio:['ignore','pipe','pipe']});
 const capture=data=>report.appOutput.push(data.toString('utf8').slice(0,2000));
 app.stdout.on('data',capture);app.stderr.on('data',capture);
 for(let i=0;i<60;i++){if(app.exitCode!==null)break;try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);break;}catch{await new Promise(r=>setTimeout(r,1000));}}
 if(!browser)throw Error(`Native WebView2 did not start (exitCode=${app.exitCode}, signal=${app.signalCode}, output=${report.appOutput.join(' ') || 'none'})`);
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
 await page.getByRole('button',{name:'复制 Prompt',exact:true}).click();await page.getByRole('status').filter({hasText:'已复制'}).waitFor();
 const clipboard=ps('[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); Get-Clipboard -Raw');assert.ok(clipboard.includes(zh));report.nativeClipboard=true;
 await mkdir(qaDir,{recursive:true});await page.screenshot({path:path.join(qaDir,'chinese.png'),fullPage:true});
 await page.getByLabel('主题',{exact:true}).selectOption('dark');await page.screenshot({path:path.join(qaDir,'chinese-dark.png'),fullPage:true});
 await page.getByRole('button',{name:'EN',exact:true}).click();await input.fill('I am designing a survival game where ammunition, time, and information affect whether the player fights or avoids enemies.');
 await page.getByRole('button',{name:'Generate RRT Prompt',exact:true}).click();assert.match(await page.locator('#prompt').inputValue(),/ammunition/);report.english=true;
 await page.getByLabel('Theme',{exact:true}).selectOption('light');await page.screenshot({path:path.join(qaDir,'english.png'),fullPage:true});
 await page.getByRole('button',{name:'Clear',exact:true}).click();assert.equal(await input.inputValue(),'');assert.equal(await page.locator('#prompt').count(),0);report.clear=true;
 await input.fill('PRIVATE_TEXT_MUST_NOT_PERSIST');
 const keys=await page.evaluate(()=>Object.keys(localStorage));assert.deepEqual(keys.sort(),['rrt-lite.language','rrt-lite.theme']);report.noInputPersistence=true;
 await page.reload();await page.waitForSelector('#context');assert.equal(await input.inputValue(),'');assert.equal(await page.getByLabel('Theme',{exact:true}).inputValue(),'light');report.preferencePersistence=true;
 await new Promise(r=>setTimeout(r,1000));
 assert.deepEqual(report.externalRequests,[]);
 assert.deepEqual(report.proxyAttempts,[]);
 console.log(JSON.stringify(report,null,2));
}catch(error){report.error=String(error);throw error;}finally{
 await mkdir(qaDir,{recursive:true});await writeFile(path.join(qaDir,reportName),JSON.stringify(report,null,2));
 if(browser)await browser.close().catch(()=>{});
 if(app?.pid)try{execFileSync('taskkill',['/PID',String(app.pid),'/T','/F']);}catch{}
 if(denyProxy)await close(denyProxy).catch(()=>{});
 for(let i=0;i<10;i++)try{await rm(userData,{recursive:true,force:true});break;}catch(error){if(i===9)report.cleanupWarning=String(error);else await new Promise(r=>setTimeout(r,250));}
 await writeFile(path.join(qaDir,reportName),JSON.stringify(report,null,2));
}
