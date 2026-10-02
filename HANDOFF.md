# Pallet Quote: handoff context

Read this before changing anything. It covers what the app is, where the code stands, how to run and test it, and what's still undecided. The product brief is in the "VPS Tools" Claude project as `claude/pallet-quote-product-context.md`. Treat it as product direction, not a list of tasks.

## 1. What this is

Pallet Quote is a browser-based quoting tool for a small, family-run timber pallet business in Australia (prices in AUD, GST at 10%). The user enters a pallet size and chooses timber, and the app works out the boards, gaps and cost. It also produces:

- a live 3D view of the pallet
- a professional shop drawing
- a customer PDF and an internal breakdown PDF

The app is local-first: there's no backend and no accounts. All data is stored in `localStorage` on the device, and a JSON file handles backup and moving data between devices. It should keep working offline after the first visit.

- Repo: https://github.com/Beef13/pallet-size-quote-calculator
- Owner's local clone (Mac): `~/Documents/DevProjects/pallet-size-quote-calculator`

## 2. Branch state (important)

| Branch | State |
|---|---|
| `main` | **Live.** Pushing to `main` runs the price tests, builds and deploys GitHub Pages (`.github/workflows/deploy.yml`) at https://beef13.github.io/pallet-size-quote-calculator/ (landing page) and `/app/` (calculator). **Don't push or merge to `main` without the owner's explicit OK each time.** |
| `fix/quote-calculator-bugs` | **Working branch.** Do new work here, then ask the owner before fast-forwarding `main` to it. |

On 2 October 2026 the owner said they had tested the app and approved the first merge, so everything up to the price tests (`c84ee92`) is live. That merge made per-metre timber pricing live: cost is the price per lineal metre × the real length, with boards cut to the pallet length and bearers to the pallet width (`timberCost()` in `src/utils/calculations.js`). The old `main` charged a flat price per board.

## 3. Run, build, test

```bash
npm install
npm run dev     # landing: http://localhost:5173/pallet-size-quote-calculator/
                # app:     http://localhost:5173/pallet-size-quote-calculator/app/
npm run build   # multi-page build to dist/
BASE_PATH=./ npx vite build   # relative base, e.g. for static previews
```

- Stack: React 18, Vite 6, `@react-three/fiber` and `drei` (three 0.160), and `@fontsource-variable/outfit`.
- `npm test` runs the price calculation tests (Vitest, `src/utils/calculations.test.js`): timber cost, deck layout, the labour and markup stack (`costStack`), order totals and GST (`orderTotals`), and one full quote end to end. The deploy workflow runs them before building, so a failing test blocks publishing. Add a test whenever the pricing rules change.
- The interface itself has no automated tests. Previous sessions verified changes with ad hoc Playwright scripts: build a 1165 × 1165 pallet, fill in the Quote tab, export both PDFs, and check for console errors.
- Use stable selectors: `[data-field="..."]` attributes on inputs, and steppers with `aria-label="Number of {label}"`.
- When stopping a dev server, kill by port (`fuser -k 5173/tcp`). Don't use `pkill -f` with a pattern that also matches your own shell command; that killed the shell in a previous session.

## 4. Layout

```
index.html                 Landing page (marketing). Links to ./app/index.html
src/landing/               landing.js (hero animation, mini calculator), landing.css, img/*.webp screenshots
app/index.html             Calculator entry; registers ../sw.js and asks it to precache first-visit assets
src/main.jsx, App.jsx      App bootstrap
src/components/
  PalletBuilderOverlay.jsx MAIN APP (~1,800 lines): state, pricing, tabs, quote history
  Pallet3DLive.jsx         3D view (bundled Outfit .woff for labels, Suspense + error boundary)
  ShopDrawing.jsx          SVG drawing sheet: plan, front and side elevations, isometric, Detail 1, title block, red callout
  PrintableQuote.jsx       Print layout, variants 'customer' and 'breakdown'
  LockIcon.jsx             Price lock toggle
  (Header, PalletBuilder, PriceEditor, QuoteForm, Results, Pallet3D are legacy and mostly unused; check before deleting)
src/utils/calculations.js  Gap maths, max boards, timberCost, formatCurrency (en-AU)
src/data/timber-prices.json Default timber types and sizes
src/styles/Workbench.css   Main app theme (tokens, card look, phone breakpoints)
src/styles/PrintableQuote.css Print CSS (A4, 10mm margins, drawing at exactly 160mm wide)
public/sw.js               Service worker 'pallet-calc-v3': same-origin GET, network-first
public/manifest.json       PWA manifest, start_url ./app/
vite.config.js             Multi-page inputs (main, app); base from BASE_PATH, default /pallet-size-quote-calculator/
```

The old Markdown guides in the root (`PROJECT_SUMMARY.md`, `IMPLEMENTATION_GUIDE.md`, `UPDATE_NOTES.md` and so on) are out of date. This file is the current reference.

## 5. How the app works

**Tabs:** Build, Quote, Quotes (history) and Prices.

**Pricing model** (`liveQuote` in `PalletBuilderOverlay.jsx`):
```
materials   = Σ timberCost(price per metre, length, count) + nails × price per nail
cost        = materials + labour per pallet
markup      = cost × markup%                  (margin% is also shown: markup / sell)
sell price  = cost + markup                   (per pallet, ex GST)
total ex    = sell × quantity;  GST = ex × gstRate (if showGst);  inc = ex + GST
```
- Leader boards are optional, wider boards on the outside edges of the top or bottom deck. The gap maths for them is shared between the 3D view and the quote (`deckGapSize`, `maxDeckBoards`).
- Board counts are limited to what physically fits.

**Storage keys** (`localStorage`, always read and written through the `readStorage`/`writeStorage` try/catch helpers):

| Key | Holds |
|---|---|
| `timberPrices` | Saved timber prices and, once edited, the business's own timber list (`listEdited`), plus `pricing: { labourPerPallet, markupPercent, gstRate, showGst }` |
| `palletPresets` | Saved pallet designs |
| `palletBusiness` | Business details: name, ABN, phone, email, address, `validDays` |
| `palletQuotes` | Quote history (see below) |
| `palletQuoteSeq-{year}` | Highest quote number used each year, so numbers aren't reused after a delete |
| `palletDarkMode` | Theme |
| `palletShowProfit` | Whether gross profit is shown on the price card (`'true'`/`'false'`) |
| `palletOpenSections` | Which folding panel sections are open (`{ id: true/false }`) |

**Quotes:**
- Numbers look like `Q{year}-{0001}`.
- Each saved quote stores the design, quantity, customer, reference, status (draft, sent, accepted or lost), and a **snapshot of the prices used**.
- Reopening a quote shows its snapshot rates, with a banner. Timber edits and Save are disabled while you're viewing a snapshot.
- "Duplicate at today's rates" makes a new quote.
- Exporting the customer PDF saves the quote and marks it Sent.
- Drafts are updated in place. Editing a quote that's already been sent or decided saves it under a new number, so issued quotes are never rewritten.

**PDFs:** both are made with `window.print()`, and both must stay on one A4 page.
- Customer PDF: business block, quote number, date, valid-until date, customer and reference, drawing, spec table with no rates, price per pallet, subtotal, GST and total.
- Breakdown PDF: itemised costs, labour, markup and margin, GST, and gross profit. Its footer says it's internal.

**Backup:** export and import a v2.0 JSON file containing prices, presets, business details and quotes. On import, quotes are merged by number, and business details are only filled in if they're empty.

**Folding sections:** the Build tab sections (Saved presets, Pallet size, Bottom boards, Top boards, Bearers) and "Your business" on the Prices tab use the `Fold` component. Each folds to its heading plus a one-line summary, and the choice is remembered. Defaults: everything open, except presets when none are saved and business details once they're filled in. Saved presets sit at the top of the Build tab. Open/close is animated by the `Reveal` wrapper (CSS grid row `0fr` to `1fr`, content stays mounted, hidden content is `inert`); the timber price groups use it too. Keep spacing inside the sliding part (`--fold-gap`), not on the section, or the layout jumps when a section toggles.

**Build progress:** each Build section heading carries a `StatusMark` (far right of the heading row: a circle whose outline fills clockwise as the section is completed, then becomes a bright green ticked circle; completion plays the same click-and-ripple as the padlock in `LockIcon.css`, so keep the two in step), driven by `buildProgress`. Fields with nothing chosen get `data-empty` and render hollow with a dashed outline. The price card lists what's left ("Still to choose: top boards and bearers"). Bottom boards count as required, matching `liveQuote.isComplete`; the owner hasn't confirmed whether some pallets have none.

**3D ghosts:** in `Pallet3DLive.jsx`, any part without a timber size yet is drawn as a faint see-through block with an outline (`GhostBoard`): boards with a count but no size, a slab where a deck has no boards, and three bearers where none are set. Ghosts sit on their own three.js layer so the ground shadow ignores them.

**Same-timber shortcut:** while a Build section has no timber, it offers a one-click "Use X, same as bottom boards" button (`sameTimberButton`).

**Quotes filter:** status chips (All, Draft, Sent, Accepted, Lost, each with a count) work together with the search box (`shownQuotes`).

**Gross profit on the price card:** an eye button on the card shows or hides a "Gross profit $X · Y% margin" line (markup × quantity). It's off by default and remembered in `palletShowProfit`, because that card is the part of the screen most likely to be shown to a customer. The button only appears once a markup is set. It's gross profit: freight and overheads aren't in the cost yet.

**Editable timber list:** the list of timber types and sizes is part of the price list (`prices.timberTypes`), not fixed. "Edit list" on the Prices tab lets a business add, rename and remove timber types and board or bearer sizes, and reset to the standard list. The rules live in `src/utils/priceList.js` (tested in `priceList.test.js`): an untouched list is the bundled `timber-prices.json` with saved prices laid over it; once edited (`listEdited: true`) it's kept exactly as saved. Edits are saved with "Save prices". If a chosen timber or size is removed, or a preset names one that no longer exists, an effect clears that choice. Quote snapshots carry their own list, so old quotes still open correctly.

**Logo:** `business.logo` is a data URL (shrunk on upload by `readLogo`, under about 350 KB) stored in `palletBusiness` and shown beside the business name on the customer PDF, capped at 10 mm tall so the quote still fits one page.

**Price lock:** timber and nail prices are locked against accidental edits, each with its own padlock. Labour, markup and GST share one padlock in their section head (lock id `pricing`). Everything starts locked on each visit.

## 6. Design rules the owner has set

- Clean, sleek look that doesn't read as AI-made: soft grey canvas, white rounded cards, pill tabs and buttons, green accent `#178a52`, Outfit font. The owner rejected a stencil font as "tacky".
- No text clipping anywhere, and every count must be typeable as well as steppable.
- Shop drawings should look like real drafting: line weights that show hierarchy, third-angle projection, a standard scale, and a red rounded-rectangle detail callout.
- Landing copy must not overclaim. Use "in minutes", not "in a minute", and don't claim features that don't exist. Freight isn't included.

## 7. Known gaps and the recommended next steps

1. **Done:** per-metre pricing is live on `main`. The owner now wants to get the product ready to sell, bit by bit: an editable timber list and logo on the PDF, freight and other cost extras, terms and a privacy page, then accounts with online storage and payments.
2. Use the app on about 10 real quotes alongside the current method, and record time taken and price differences.
3. Likely gaps, to be confirmed with the owner before building:
   - freight (per load or per pallet)
   - heat treatment charge
   - waste allowance %
   - minimum order charge
   - finding customers from past quotes
   - **crate builder/quoter** (parked — owner asked to save for later, not build yet): same
     enquiry-to-quote flow as pallets but for crates (L × W × H + base/sides/lid/battens,
     screws). Reuse timber prices, labour/markup/GST, history, presets, PDFs; new work is
     crate geometry/costing, a box 3D view, and crate shop drawings. Open questions:
     slatted vs plywood-panel construction, quotable parts, internal vs external dimensions,
     and whether crates need the full drawing + PDF package from day one.
4. Data lives on one device. Ask whether several people or devices quote before considering sync or accounts. The brief says to stay local-first unless there's evidence a change is needed.
5. Small items:
   - The nail price defaults to $0.
   - The legacy components could be removed.
   - The JS bundle is large (about 1.1 MB, mostly three.js); split it if load time matters.

Don't build ERP, production or recycled-pallet features until the core quoting workflow has been tested on real quotes.

## 8. Conventions

- Commit messages: a plain summary line plus a bullet body. Work on a branch, never directly on `main`.
- Wrap all storage access in try/catch, because private mode and quota limits can make it fail.
- After any change to the print layout, re-check that both PDFs still fit on one page.
