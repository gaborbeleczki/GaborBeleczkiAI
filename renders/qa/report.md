# QA report

Generated 2026-11-06T23:36:55.783Z in 441s. Headless Chromium with software WebGL (SwiftShader).

## Screenshots

21 captured: page-desktop-top, page-desktop-full, cv-desktop, note-desktop, page-phone-top, page-phone-full, page-dark-top, studio-evening-home, studio-folio-hello, studio-folio-approach, studio-folio-role, studio-folio-work, studio-folio-career, studio-folio-toolkit, studio-folio-faq, studio-folio-contact, studio-shelf, studio-record, studio-evening-window, studio-day-home, studio-day-window.
No console errors.

## Performance

- Page: 2040 KB transferred, load 620 ms, LCP 156 ms
- Studio: 12423 KB transferred, ready in 23613 ms, frame time median 16.7 ms / p95 2466.5 ms (software WebGL (SwiftShader) in headless Chromium)
- dist: 14936 KB total (models 571 KB, textures 10334 KB, JS 813 KB)

## Pixel difference (WebGL vs Cycles reference, home camera)

- evening: 9.57% pixels differ beyond threshold, mean |Δluma| 10.57 (WebGL 96.4 vs Cycles 95)
- day: 11.56% pixels differ beyond threshold, mean |Δluma| 10.65 (WebGL 116.4 vs Cycles 120.1)

## Adversarial checks

- PASS no WebGL → page by default
- PASS no WebGL + ?studio → falls back to page with a notice
- PASS prefers-reduced-motion → page by default
- PASS studio.glb missing → page with notice
- PASS rapid input: keys 0-7, clicks, resizes
- PASS WebGL context lost → page
- PASS keyboard: skip link + focus order on the page
- PASS keyboard: studio chapters menu
- PASS game: plays with keys, pauses when you leave the desk
- PASS music: 16 s offline render, no clipping, not silent
- PASS page: seven animated case figures
- PASS routes: /, /cv/, /notes/, note, rss, sitemap, robots
