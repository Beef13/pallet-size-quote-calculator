# Landing page media

Scripts that produced the screenshots, sample PDFs and demo videos on the landing page.
They drive the real calculator with Playwright, so the images always show genuine output.

- `capture.mjs` (uses `state.mjs`): every screenshot, light or dark. Writes PNGs to a folder you pass.
- `sample.mjs`: the sample customer quote and cost breakdown PDFs in `public/`.
- `record-desktop-video.mjs`, `record-phone-video.mjs`: the demo recordings (`src/landing/img/app-demo-*`).
  The videos are not used on the page at present but the files are kept.

They expect the app running locally (`BASE_PATH=/ npx vite --port 5196 --strictPort`), Playwright
installed, and a Chromium at `/opt/pw-browsers/chromium`; adjust the port and browser path inside
each script for your machine. Frames from the video scripts are encoded with ffmpeg.

`steps.mjs` captured frame-by-frame crops of the real calculator, one per click and keystroke, for an
animated version of "How it works" (with `steps-<theme>.json` recording where each click landed).
The page went back to plain screenshots on 3 Oct 2026, so the script is not used at present but is kept;
the animated version is in the history of the `landing-redesign` branch (commit 8ae2f2b).
