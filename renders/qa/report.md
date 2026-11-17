# QA report

Generated 2026-11-17T20:49:29.107Z in 794s. Headless Chromium with software WebGL (SwiftShader).

## Screenshots

44 captured: page-original-desktop, page-desktop-top, page-desktop-full, cv-desktop, note-desktop, note-side-quests, page-phone-original, page-phone-top, page-phone-full, page-dark-top, studio-evening-home, studio-display-hello, studio-display-approach, studio-display-role, studio-display-work, studio-display-career, studio-display-toolkit, studio-display-faq, studio-display-contact, studio-dossier-hello, studio-dossier-role, studio-dossier-work, studio-dossier-work-p2, studio-dossier-career, studio-dossier-contact, studio-objects, studio-hold-cards, studio-hold-phone, studio-hold-cv, studio-hold-notebook, studio-globe, studio-quests, studio-board-card, studio-run, studio-runlog, studio-runlog-chart, studio-dossier-approach, studio-adoption, studio-legend, studio-shelf, studio-record, studio-evening-window, studio-day-home, studio-day-window.
Console errors: 2

- console: Failed to load resource: the server responded with a status of 404 (Not Found)
- console: Failed to load resource: the server responded with a status of 404 (Not Found)

## Performance

- Page: 2170 KB transferred, load 553 ms, LCP 180 ms
- Studio: 16210 KB transferred, ready in 33360 ms, frame time median 1826.8 ms / p95 4549.9 ms (software WebGL (SwiftShader) in headless Chromium)
- dist: 35879 KB total (models 1366 KB, textures 12707 KB, JS 928 KB)

## Pixel difference (WebGL vs Cycles reference, home camera)

- evening: 18.45% pixels differ beyond threshold, mean |Δluma| 15.87 (WebGL 102.5 vs Cycles 103.8)
- day: 18.48% pixels differ beyond threshold, mean |Δluma| 15.07 (WebGL 125.5 vs Cycles 133.4)

## Adversarial checks

- PASS no WebGL → the original page
- PASS no WebGL + ?studio → the original page with a note
- PASS prefers-reduced-motion → the original page
- PASS software WebGL → the original page
- PASS studio.glb missing → the original page
- PASS rapid input: keys 0-7, Escape, resizes
- PASS WebGL context lost → the original page
- PASS keyboard: skip link + focus order on the static page
- PASS keyboard: chapters menu opens a dossier
- PASS dossier: opens, turns pages, goes back
- PASS desk: cards, phone, CV, notebook; hotspots
- PASS game: plays with keys, pauses when you leave the desk
- PASS music: 16 s offline render, no clipping, not silent
- PASS page: seven animated case figures
- PASS page view: the original portfolio in a frame, a way back to the studio
- PASS side quests: wall, board, a card, the training log
- PASS legend: plays on the display, Escape skips it
- PASS adoption: counted once, remembered
- PASS routes: pages, original, CVs, feeds, assets
