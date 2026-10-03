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

`steps.mjs` captures the frames for the "How it works" panels: close crops of the real calculator
taken one after another as it is driven through each step (`node tools/landing-media/steps.mjs <folder> light`,
then `dark`). Convert the PNGs to `src/landing/img/step-<name>-<frame>-<theme>.webp`; the 3D crops are
scaled to 990 x 750. The page shows each set of frames in turn, so nothing in those panels is drawn by hand.
