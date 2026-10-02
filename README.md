# RRT Lite

**Resource Redemption Theory Prompt Builder · 资源兑现理论 Prompt 生成器**

A Windows-first, offline, bilingual introduction to RRT. Describe a game, mechanic/system, prototype, GDD excerpt, or design problem; choose a Lite focus; generate a prompt locally; copy it into any external text AI.

## 下载 / Download

Use the assets on this repository's **Releases** page:

- `RRT-Lite-Setup.exe`: Windows x64 installer, includes its renderer. No online bootstrap step.
- `RRT-Lite-Windows-Portable.zip`: extract the **entire** archive, then double-click `RRT Lite/RRT-Lite.exe`. Keep the adjacent `WebView2` folder.
- `SHA256SUMS.txt`: checksums for the distributables.

The application does not require a developer environment, account, API key, browser website, or server. It generates a prompt, not an AI answer. Windows 10/11 x64 is the target; Windows CI validation is reported with the release. This first release is unsigned; no signing identity or certificate has been purchased or represented.

安装版和便携版均包含固定版本 WebView2，首次启动无需联网下载运行库。便携版必须完整解压，不能只复制 exe。界面支持中文、English、浅色、深色及跟随系统。

## Privacy / 隐私

- No AI API, analytics, telemetry SDK, remote configuration, database, account, automatic update, or server.
- Templates, JavaScript, styles, icons, React, and the renderer are packaged locally; fonts use Windows system fonts.
- Only language and theme are stored locally. Pasted design text and generated prompts stay in memory and are not saved by the app.
- Copy is an explicit local clipboard operation. Windows clipboard history/sync and any external AI you choose are controlled by your OS/other software, not by this application.
- A restrictive Content Security Policy allows only local assets and Tauri's local IPC for clipboard writing. No business-logic network calls exist.
- Fixed WebView2 avoids an updater service; background-networking and component-update flags are disabled. Native release tests force the renderer through a local deny proxy, fail on any attempted external request, and do not alter the host firewall or network settings.
- Dependencies and the fixed renderer are downloaded **at build time**, not when someone runs the application.

## RRT Lite public boundary

Only Lite definitions and the nine-section output are included: Resource, Decision, Redemption, Agency, Gameplay Efficiency, Narrative Completion, Throughput, main tension and one testable question. Known information is separated from inference. There is no complete Skill, research workflow, client SOP, private note, scoring system, dataset, or GDD production pipeline.

This repository is independent of RRT Evolution Atlas, the RRT Prompt Builder website, ChatGPT Sites, Cloudflare Workers and D1. It contains no imports, runtime calls, database exports, or vendored source from those projects.

## Development

Use Node.js 22+, Rust stable, and the Windows Tauri prerequisites (Visual Studio C++ build tools, Windows SDK). Developer builds use the system WebView2; distribution builds include a fixed runtime.

```sh
npm ci
npm test
npm run build
npm run tauri dev
```

For a complete offline Windows distribution in PowerShell:

```powershell
./scripts/prepare-runtime.ps1
npm run desktop:build
./scripts/package-windows.ps1
node scripts/test-native.mjs
```

The native test does not require administrator privileges or change Windows Firewall. It launches WebView2 through a process-scoped local deny proxy, exercises the packaged UI and native clipboard, and fails if the page or renderer attempts an external request.

`main` pushes and `v*` tags trigger the Windows build. Normal pushes and manual validation runs retain artifacts without publishing. A `v0.1.0` tag or an explicit `publish_release` workflow input publishes `v0.1.0` only after every verification step passes; an existing release is never overwritten. For a new release version, update app/package/Cargo versions and the release step.

## Edit the prompts

- `src/prompts/en/*.ts`: English modules.
- `src/prompts/zh/*.ts`: Chinese modules.
- `src/prompts/index.ts`: target scope, focus selection and assembly.
- `src/i18n.ts`: UI translations.
- `src/App.tsx`: workflow and in-memory state.
- `src/preferences.ts`: language/theme persistence only.

## Author / 作者

Xilin Xu · Discord: **badgermunsta**

For deeper RRT analysis, game-system diagnosis, or design discussion, contact the author.

需要更深入的 RRT 分析、游戏系统诊断或设计讨论，可以联系作者。

## Licensing

No project-wide license has been selected. Public availability is not a grant of additional copyright permissions. No GPL/AGPL license has been added. Dependencies and the Microsoft runtime retain their own licenses; see `THIRD-PARTY-NOTICES.md` and the notices packaged with the renderer.
