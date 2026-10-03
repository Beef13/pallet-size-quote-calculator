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

`steps.mjs` captures the frames for the "How it works" panels: close crops of the real calculator,
one frame per click and per keystroke as it is driven through each step
(`node tools/landing-media/steps.mjs <folder> light`, then `dark`). It also writes `steps-<theme>.json`,
which records for every frame what led to it (a click, a key, a change of section) and where on the crop
the click landed. From those, the frames are converted to `src/landing/img/step-<name>-<frame>-<theme>.webp`
(3D crops scaled to 990 x 750) and each reel in `index.html` gets its `data-times` and `data-cursor`.
The page shows the frames in turn and moves a pointer to each recorded position, so nothing in those
panels is drawn by hand except the pointer itself.
