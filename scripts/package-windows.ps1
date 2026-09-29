$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory artifacts -Force | Out-Null
$setup = Get-ChildItem src-tauri/target/release/bundle/nsis/*-setup.exe | Select-Object -First 1
if (!$setup) { throw 'NSIS installer not found' }
Copy-Item $setup.FullName artifacts/RRT-Lite-Setup.exe
$portable = Join-Path $PWD 'artifacts/portable/RRT Lite'
New-Item -ItemType Directory $portable -Force | Out-Null
Copy-Item src-tauri/target/release/rrt-lite.exe "$portable/RRT-Lite.exe"
Copy-Item src-tauri/runtime "$portable/WebView2" -Recurse
Copy-Item README.md "$portable/README.md"
Copy-Item THIRD-PARTY-NOTICES.md "$portable/THIRD-PARTY-NOTICES.md"
Compress-Archive -Path $portable -DestinationPath artifacts/RRT-Lite-Windows-Portable.zip -CompressionLevel Optimal -Force
Get-FileHash artifacts/RRT-Lite-Setup.exe,artifacts/RRT-Lite-Windows-Portable.zip -Algorithm SHA256 | ForEach-Object {"$($_.Hash.ToLower())  $([IO.Path]::GetFileName($_.Path))"} | Set-Content artifacts/SHA256SUMS.txt
