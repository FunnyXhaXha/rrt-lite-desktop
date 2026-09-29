$ErrorActionPreference = 'Stop'
# Build-time download only. No download or updater exists in the shipped application.
$version = '154.0.4258.37'
$url = 'https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/b82d47e8-d146-4563-94d1-3a3176b25c0a/Microsoft.WebView2.FixedVersionRuntime.154.0.4258.37.x64.cab'
$cab = Join-Path $env:RUNNER_TEMP 'rrt-webview2.cab'
if (!$env:RUNNER_TEMP) { $cab = Join-Path $env:TEMP 'rrt-webview2.cab' }
Invoke-WebRequest -Uri $url -OutFile $cab
$hash = (Get-FileHash $cab -Algorithm SHA256).Hash
$stage = Join-Path ([IO.Path]::GetDirectoryName($cab)) 'rrt-webview-extract'
New-Item -ItemType Directory -Path $stage -Force | Out-Null
& expand.exe $cab '-F:*' $stage | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'WebView2 extraction failed' }
$exe = Get-ChildItem $stage -Recurse -Filter msedgewebview2.exe | Select-Object -First 1
if (!$exe) { throw 'Fixed runtime executable missing' }
$signature = Get-AuthenticodeSignature $exe.FullName
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') { throw 'Runtime Microsoft signature validation failed' }
$destination = Join-Path $PWD 'src-tauri/runtime'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item (Join-Path $exe.Directory.FullName '*') $destination -Recurse -Force
New-Item -ItemType Directory artifacts -Force | Out-Null
@{version=$version;source=$url;cabSHA256=$hash;signature=$signature.Status.ToString()} | ConvertTo-Json | Set-Content artifacts/runtime-provenance.json
