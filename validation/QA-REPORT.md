# HP Party Quest 2.1.0 — live-readiness report

Validated on 2026-11-20.

## Passed

- Frontend JavaScript syntax.
- Combined Google Apps Script backend syntax.
- Native Google Sheets table compatibility and repeated setup safety.
- Automatic runtime bootstrap from the public health endpoint.
- Automatic Apps Script URL and GitHub Pages URL configuration.
- Release workflow structure and YAML parsing.
- Apps Script project-ID resolver.
- Runtime configuration generator with strict URL validation.
- Mobile browser flow at 390 × 844: registration, persistent session, personal QR rendering, candidate lookup and vote confirmation.
- Live verifier rejects placeholders, wrong versions, unhealthy runtime state and unavailable pages.

## Publication attempt

Publication stopped at credential preflight. This execution environment has neither a transferable Google `clasp` OAuth session nor a GitHub token/session. The public repository and expected GitHub Pages address were also not present when checked. No partial live deployment was claimed.

## Prepared release behavior

Once the two owner-authenticated sessions are injected into an execution environment, `.github/workflows/release-live.yml` performs the remaining work without editing source files or the spreadsheet: resolve project, push backend, deploy Web App, bootstrap Sheets, generate frontend configuration, enable/deploy Pages, and verify both live URLs.
