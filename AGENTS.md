# Project Context: Zen Browser Command Center

## Architecture Rules
- **Target Engine:** Firefox / Gecko (Zen Browser).
- **API Namespace:** Strictly use the Promise-based `browser.*` API. NEVER use the callback-heavy `chrome.*` API.
- **Storage:** Use `browser.storage.local`.
- **Authentication:** Use `browser.identity.launchWebAuthFlow` for OAuth2.

## Technology Stack
- Vanilla JavaScript ONLY. No React, no Vite, no bundlers.
- Tailwind CSS (via CDN or existing stylesheet).