RRT Lite v0.1.0 — Windows x64

- 中文 / English interface and prompts
- Offline, local RRT Lite prompt generation
- Game / System / Prototype / GDD / Design Problem
- Focus selection, native clipboard copy, and clear
- Light / Dark / System themes
- No AI API, login, analytics SDK, or telemetry SDK
- Only language and theme are saved; design text is not retained
- Installer and portable ZIP include a fixed WebView2 runtime for offline first launch

Extract the entire portable ZIP before opening RRT-Lite.exe. This release is unsigned.

Validation: the release pipeline must pass bilingual tests and keyboard-driven native tests of both portable and installed packages. The same release binary is configured with a process-scoped deny proxy; tests fail on any attempted proxy connection and do not enable remote debugging or change Windows Firewall. See portable-native-test-report.json and installed-native-test-report.json.

Author: Xilin Xu · Discord: badgermunsta
