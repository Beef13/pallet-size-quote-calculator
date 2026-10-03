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

The desktop recording is made in a 1280 x 800 window (16:10, the shape of a laptop screen) and encoded at
1600 x 1000, 30 frames a second, from the frame list the script writes:
`ffmpeg -f concat -safe 0 -i list.txt -vf "fps=30,scale=1600:1000:flags=lanczos,format=yuv420p" -c:v libx264 -profile:v high -preset slow -crf 27 -movflags +faststart -an app-demo-light.mp4`
and the same with `-c:v libvpx-vp9 -b:v 0 -crf 38` for the WebM. The script also saves `poster-<theme>.jpg`.
