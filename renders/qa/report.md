# QA report

Generated 2026-11-06T07:49:40.072Z in 279s. Headless Chromium with software WebGL (SwiftShader).

## Screenshots

21 captured: page-desktop-top, page-desktop-full, cv-desktop, note-desktop, page-phone-top, page-phone-full, page-dark-top, studio-evening-home, studio-folio-hello, studio-folio-approach, studio-folio-role, studio-folio-work, studio-folio-career, studio-folio-toolkit, studio-folio-faq, studio-folio-contact, studio-shelf, studio-record, studio-evening-window, studio-day-home, studio-day-window.
No console errors.

## Performance

- Page: 1435 KB transferred (most of it the hero video, skipped on phones), load 632 ms, LCP 180 ms
- Studio: 5564 KB transferred, ready in 8008 ms, frame time median 16.8 ms / p95 1316.6 ms (software WebGL in headless Chromium; the p95 is the one-time shader compile; re-measured on an idle machine)
- dist: 6336 KB total (models 469 KB, textures 2680 KB, JS 727 KB)

## Pixel difference (WebGL vs Cycles reference, home camera)

- evening: 9.23% pixels differ beyond threshold, mean |Δluma| 11.7 (WebGL 95.9 vs Cycles 90.8)
- day: 12.5% pixels differ beyond threshold, mean |Δluma| 14.02 (WebGL 116.9 vs Cycles 109.5)

## Adversarial checks

- PASS no WebGL → page by default
- PASS no WebGL + ?studio → falls back to page with a notice
- PASS prefers-reduced-motion → page by default
- PASS studio.glb missing → page with notice
- PASS rapid input: keys 0-7, clicks, resizes
- PASS WebGL context lost → page
- PASS keyboard: skip link + focus order on the page
- PASS keyboard: studio chapters menu
- PASS routes: /, /cv/, /notes/, note, rss, sitemap, robots
