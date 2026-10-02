// Runs only in Windows CI/development, never included in the desktop runtime.
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';

const exe = path.resolve(process.argv[2] || 'artifacts/portable/RRT Lite/RRT-Lite.exe');
const qaDir = path.resolve(process.argv[3] || 'artifacts/qa');
const reportName = process.argv[4] || 'native-test-report.json';
const userData = path.join(qaDir, '.webview-data');
const denyProxyPort = 65535;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const ps = script => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' });

function processSnapshot(pid) {
  const script = `
$rootPid = ${pid}
$all = Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine,ExecutablePath,SessionId
$ids = [Collections.Generic.HashSet[uint32]]::new()
[void]$ids.Add([uint32]$rootPid)
do {
  $added = $false
  foreach ($process in $all) {
    if ($ids.Contains([uint32]$process.ParentProcessId) -and $ids.Add([uint32]$process.ProcessId)) { $added = $true }
  }
} while ($added)
$root = Get-Process -Id $rootPid -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Responding,SessionId,MainWindowHandle
$tree = @($all | Where-Object { $ids.Contains([uint32]$_.ProcessId) })
[pscustomobject]@{ root = $root; processes = $tree } | ConvertTo-Json -Compress -Depth 4
`;
  try { return JSON.parse(ps(script)); } catch (error) { return { error: String(error) }; }
}

function setClipboardText(value) {
  const encoded = Buffer.from(value, 'utf8').toString('base64');
  ps(`$value=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(${quote(encoded)})); Set-Clipboard -Value $value`);
}

function getClipboardText() {
  const output = ps("[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $value=Get-Clipboard -Raw; if($null -eq $value){$value=''}; $value | ConvertTo-Json -Compress").trim();
  return output ? JSON.parse(output) : '';
}

function sendKeys(pid, keys, waitMs = 350) {
  ps(`$shell=New-Object -ComObject WScript.Shell; if(-not $shell.AppActivate(${pid})){throw 'Could not activate RRT Lite'}; Start-Sleep -Milliseconds 200; $shell.SendKeys(${quote(keys)}); Start-Sleep -Milliseconds ${waitMs}`);
}

function screenshot(pid, destination) {
  ps(`
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RrtWindowCapture {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
'@
$process=Get-Process -Id ${pid}
$rect=New-Object RrtWindowCapture+RECT
if(-not [RrtWindowCapture]::GetWindowRect($process.MainWindowHandle,[ref]$rect)){throw 'Could not read application window bounds'}
$width=$rect.Right-$rect.Left; $height=$rect.Bottom-$rect.Top
if($width -le 0 -or $height -le 0){throw 'Application window has invalid bounds'}
$bitmap=New-Object Drawing.Bitmap $width,$height
$graphics=[Drawing.Graphics]::FromImage($bitmap)
try { $graphics.CopyFromScreen($rect.Left,$rect.Top,0,0,$bitmap.Size); $bitmap.Save(${quote(destination)},[Drawing.Imaging.ImageFormat]::Png) }
finally { $graphics.Dispose(); $bitmap.Dispose() }
`);
}

async function waitForWindow(app, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (app.exitCode !== null) throw new Error(`RRT Lite exited before opening a window: ${app.exitCode}`);
    const handle = Number(ps(`(Get-Process -Id ${app.pid} -ErrorAction SilentlyContinue).MainWindowHandle`).trim() || 0);
    if (handle) return Date.now() - started;
    await delay(500);
  }
  throw new Error('RRT Lite did not create a window within 30 seconds');
}

async function containsPrivateText(root, privateText) {
  const utf8 = Buffer.from(privateText, 'utf8');
  const utf16 = Buffer.from(privateText, 'utf16le');
  async function scan(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (await scan(fullPath)) return true;
      } else if (entry.isFile() && (await stat(fullPath)).size <= 32 * 1024 * 1024) {
        const contents = await readFile(fullPath);
        if (contents.indexOf(utf8) !== -1 || contents.indexOf(utf16) !== -1) return true;
      }
    }
    return false;
  }
  return scan(root);
}

const report = {
  startup: false,
  chinese: false,
  english: false,
  languagePreservation: false,
  nativeClipboard: false,
  clear: false,
  preferencePersistence: false,
  noInputPersistence: false,
  proxyConfigured: false,
  proxyAttempts: [],
  appOutput: [],
  networkIsolation: 'The release WebView2 is configured with a process-scoped loopback deny proxy; Windows Firewall and system network settings are unchanged.'
};

let app;
let denyProxy;
try {
  await mkdir(qaDir, { recursive: true });
  await rm(userData, { recursive: true, force: true });
  denyProxy = net.createServer(socket => {
    socket.once('data', data => report.proxyAttempts.push(data.toString('utf8', 0, 512).split(/\r?\n/, 1)[0]));
    socket.destroy();
  });
  await new Promise((resolve, reject) => {
    denyProxy.once('error', reject);
    denyProxy.listen(denyProxyPort, '127.0.0.1', resolve);
  });

  const launch = async () => {
    app = spawn(exe, [], {
      env: { ...process.env, WEBVIEW2_USER_DATA_FOLDER: userData },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const capture = data => report.appOutput.push(data.toString('utf8').slice(0, 2000));
    app.stdout.on('data', capture);
    app.stderr.on('data', capture);
    report.startupDurationMs = await waitForWindow(app);
    // A native window handle can exist before the bundled WebView has finished
    // loading and can reliably receive synthesized keyboard input on a cold start.
    await delay(2500);
    return app;
  };

  await launch();
  const snapshot = processSnapshot(app.pid);
  report.processSnapshot = snapshot;
  const browser = snapshot.processes?.find(process => process.Name?.toLowerCase() === 'msedgewebview2.exe' && process.ParentProcessId === app.pid);
  assert.ok(browser, 'Bundled WebView2 browser process was not found');
  assert.match(browser.CommandLine || '', /--proxy-server=http:\/\/127\.0\.0\.1:65535/);
  assert.match(browser.CommandLine || '', /--disable-background-networking/);
  assert.doesNotMatch(browser.CommandLine || '', /remote-debugging/);
  report.proxyConfigured = true;
  report.startup = true;

  // Select English, enter sample material, and generate a prompt.
  sendKeys(app.pid, '{TAB 2}');
  sendKeys(app.pid, '{ENTER}');
  sendKeys(app.pid, '{TAB 15}');
  const en = 'I am designing a survival game where ammunition, time, and information affect whether the player fights or avoids enemies.';
  setClipboardText(en); sendKeys(app.pid, '^v');
  sendKeys(app.pid, '{TAB}'); sendKeys(app.pid, '{ENTER}', 900);
  sendKeys(app.pid, '{TAB}');
  sendKeys(app.pid, '{TAB}'); sendKeys(app.pid, '{ENTER}', 600);
  let output = getClipboardText();
  assert.ok(output.includes(en));
  assert.ok(output.includes('Core Resource Structure'), `English generated prompt was not copied (clipboard prefix: ${JSON.stringify(output.slice(0, 200))})`);
  report.english = true;
  report.nativeClipboard = true;
  screenshot(app.pid, path.join(qaDir, 'english.png'));

  // Clear the form and verify that the input is empty.
  sendKeys(app.pid, '{TAB}'); sendKeys(app.pid, '{ENTER}');
  const clearMarker = 'CLEAR_VERIFIED';
  setClipboardText(clearMarker); sendKeys(app.pid, '^v'); sendKeys(app.pid, '^a'); sendKeys(app.pid, '^c');
  assert.equal(getClipboardText(), clearMarker);
  report.clear = true;

  // Switch to Chinese and verify that the current input survives the language change.
  sendKeys(app.pid, '+{TAB 16}'); sendKeys(app.pid, '{ENTER}'); sendKeys(app.pid, '{TAB 16}');
  sendKeys(app.pid, '^a'); sendKeys(app.pid, '^c');
  assert.equal(getClipboardText(), clearMarker);
  report.languagePreservation = true;
  const zh = '我正在设计一个玩家经营商店，通过交易不同物品影响顾客未来状态的游戏。';
  setClipboardText(zh); sendKeys(app.pid, '^a'); sendKeys(app.pid, '^v');
  sendKeys(app.pid, '{TAB}'); sendKeys(app.pid, '{ENTER}', 900);
  sendKeys(app.pid, '{TAB}');
  sendKeys(app.pid, '{TAB}'); sendKeys(app.pid, '{ENTER}', 600);
  output = getClipboardText();
  assert.ok(output.includes(zh));
  assert.ok(output.includes('核心资源结构'), `Chinese generated prompt was not copied (clipboard prefix: ${JSON.stringify(output.slice(0, 200))})`);
  report.chinese = true;
  sendKeys(app.pid, '{TAB 2}'); sendKeys(app.pid, '{END}');
  screenshot(app.pid, path.join(qaDir, 'chinese-dark.png'));

  // Put private text in memory, close, and confirm it is absent from the WebView data directory.
  sendKeys(app.pid, '+{TAB 5}');
  const privateText = 'PRIVATE_TEXT_MUST_NOT_PERSIST';
  setClipboardText(privateText); sendKeys(app.pid, '^a'); sendKeys(app.pid, '^v');
  execFileSync('taskkill', ['/PID', String(app.pid), '/T', '/F']);
  app = undefined;
  await delay(1000);
  assert.equal(await containsPrivateText(userData, privateText), false);
  report.noInputPersistence = true;

  // Restart with the same profile: language/theme preferences remain, input does not.
  await launch();
  sendKeys(app.pid, '{TAB 17}');
  const restartMarker = 'RESTART_INPUT_EMPTY';
  setClipboardText(restartMarker); sendKeys(app.pid, '^v'); sendKeys(app.pid, '^a'); sendKeys(app.pid, '^c');
  assert.equal(getClipboardText(), restartMarker);
  report.preferencePersistence = true;

  await delay(1000);
  assert.deepEqual(report.proxyAttempts, []);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = String(error);
  throw error;
} finally {
  await mkdir(qaDir, { recursive: true });
  if (app?.pid) try { execFileSync('taskkill', ['/PID', String(app.pid), '/T', '/F']); } catch {}
  if (denyProxy) await new Promise(resolve => denyProxy.close(resolve));
  for (let i = 0; i < 10; i++) {
    try { await rm(userData, { recursive: true, force: true }); break; }
    catch (error) { if (i === 9) report.cleanupWarning = String(error); else await delay(250); }
  }
  await writeFile(path.join(qaDir, reportName), JSON.stringify(report, null, 2));
}
