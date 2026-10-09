# Copy editor

A page for rewriting the wording on the site: the landing pages, the terms and privacy pages,
the calculator's labels and messages, and the fixed text on the quote PDFs.

It runs only on your own computer. It is not part of the built site and is never deployed.

## Using it

```bash
npm install      # once, or after pulling new changes
npm run editor   # starts the site locally and opens the editor
```

The editor opens at `http://localhost:5173/__copy/`.

- Pick a part of the site on the left. The wording is listed in the order it appears.
- Click into any text and type. The page beside it rings the text you are on, and plain text
  changes there as you type.
- **Save changes** writes the new wording into the site's files on this computer. Unsaved edits
  are kept by the browser, so closing the tab does not lose them.
- Nothing changes on the live site until the files are committed and deployed.

Blue pills inside a sentence (`number`, `quantity`) are values the page or the app fills in. They
can be moved within the sentence or deleted, but not retyped. Bold text and links keep their
formatting and their destination; only their words change.

## How it stays in step with the site

There is no list of editable fields to maintain. Each time the editor loads (and every few
seconds while it is open) it reads the site's own files:

- **Pages** are the HTML files listed under `build.rollupOptions.input` in `vite.config.js`.
  Add a page there and it appears in the editor.
- **App and PDF text** comes from every JS/JSX file those pages load, found by following their
  imports. A component that is imported but never used is left out.
- Within each file, text is found by parsing it: text between tags, `aria-label`, `title`, `alt`
  and `placeholder` attributes, page titles and descriptions, and strings in the code that read
  as wording rather than as class names, ids, paths or settings.

So a new section on the landing page, a new tab in the app or a new line on the PDF shows up by
itself, and anything removed disappears.

Two versions of a passage (`data-accounts`, `data-billing`) are listed separately and labelled
with when each is shown.

## Safety

An edit replaces only the characters of that piece of text. Before anything is written, the
changed file is checked: a JS/JSX file must contain exactly the same code as before (apart from
the wording and any live value deliberately removed), and an HTML page must have the same
structure. If not, nothing is saved. If the file has changed since the editor read it, the editor
reloads it and tries once more.

## Known limits

- The PDFs have no preview beside the editor. Export a quote in the calculator to see them.
- A string in the code is listed only if it reads as wording. `looksLikeCopy()` in `scan.js`
  holds the rules; `CODE_NAMES` and `CODE_CALLS` list the attributes and calls that are always
  code. If something is missing or listed by mistake, that is where to adjust it.
- Timber names and default prices (`src/data/timber-prices.json`) and the operator's details
  (`src/landing/operator.js` ABN and email) are data, not wording, and are edited in those files.

## Files

- `scan.js` finds the text and writes edits back. `scan.test.js` tests it.
- `plugin.js` is the Vite plugin that serves the editor while developing (`apply: 'serve'`).
- `ui/` is the editor page.
