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
| `main` (7 Oct 2026) | The owner asked for the current **app** to go live without the new landing page. `main` now has the app, styles, sync and utils from `landing-live-demo`, with the older landing, terms and privacy pages left as they were. The animated landing page and the pricing section are still only on `landing-live-demo`. |
| `landing-live-demo` | **Working branch from 6 Oct 2026.** Has everything: the animated landing page (3D laptop, phone section, live demo), the app changes from `fix/quote-calculator-bugs` (phone layout, grouped History, Quote tab) and the $49 / $490 / Custom pricing. Do new work here, then ask the owner before merging to `main`. |
| `fix/quote-calculator-bugs` | **Superseded.** Merged into `landing-live-demo` on 6 Oct 2026. It has the older landing page; don't add to it. |
| `landing-copy`, `landing-redesign`, `landing-video-hero`, `landing-live-main`, `pricing-on-landing-copy` | Earlier landing page attempts, kept for history. Check `git ls-remote --heads origin` before assuming which branch is current. |

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
  useBottomSheet.js        Phone layout: the swipe-up card (drag, snap, measurements)
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

**Tabs:** Build, Quote, History (saved quotes) and Prices.

**Pricing model** (`liveQuote` in `PalletBuilderOverlay.jsx`):
```
materials   = Σ timberCost(price per metre, length, count) + nails × price per nail
cost        = materials + labour per pallet
markup      = cost × markup%   or a set $ per pallet   (margin% is also shown: markup / sell)
sell price  = cost + markup                   (per pallet, ex GST)
total ex    = sell × quantity;  GST = ex × gstRate (if showGst);  inc = ex + GST
```
- Markup is either a percentage of cost or a dollar amount per pallet, chosen with the small % / $ switch beside "Markup on cost" on the Prices tab (added 7 Oct 2026 at the owner's request). `pricing.markupType` is `'percent'` (default) or `'amount'`; `markupPercent` and `markupAmount` are both kept, so switching back restores the other figure. `costStack()` returns `markupType`, `markupSet` and the markup as a percentage of cost either way. A dollar markup shows as "Markup" on the Quote tab and "Markup per pallet" on the breakdown PDF, each with the margin it gives. Quotes saved before this have no `markupType` and are read as percent.
- Leader boards are optional, wider boards on the outside edges of the top or bottom deck. The gap maths for them is shared between the 3D view and the quote (`deckGapSize`, `maxDeckBoards`).
- Board counts are limited to what physically fits.

**Storage keys** (`localStorage`, always read and written through the `readStorage`/`writeStorage` try/catch helpers):

| Key | Holds |
|---|---|
| `timberPrices` | Saved timber prices and, once edited, the business's own timber list (`listEdited`), plus `pricing: { labourPerPallet, markupPercent, markupType, markupAmount, gstRate, showGst }` |
| `palletPresets` | Saved pallet designs |
| `palletBusiness` | Business details: name, `country` (`AU` or `NZ`), tax number (stored as `abn` for both countries), phone, email, address, `validDays` |
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

**Phone layout (900px wide and under):** the 3D pallet is the page and the panel is a card that slides up from the bottom (`src/components/useBottomSheet.js`, styles in the "Phones: the pallet is the page" section at the end of `Workbench.css`). Closed, the card shows only its grip: a handle and the price card (the same `priceCard` element the computer layout puts on the 3D view), and the pallet can be turned and zoomed. Swiping or tapping the grip opens the tabs; swiping down from the grip, or from the top of the list, closes it. Open, the card covers the whole screen, pallet included (owner's call, to give the form the most room), and the grip shrinks to a slim bar: a down arrow with "Swipe down for the pallet", and the price, label and pallets stepper on one row in smaller type; the "Still to choose" line is hidden while open. The grip is only measured for the closed height (`--peek`) while the card is closed. The header (brand, account and theme buttons) floats over the 3D view on phones, so the account and theme buttons are reached with the card closed. Position is one number, `--sheet-p` (0 closed, 1 open), written straight to CSS variables on `.workbench` while dragging so React doesn't re-render. The phone styles are `screen` only, so printing uses the computer layout. Checked in Chromium at phone sizes with simulated touch; **not yet tried on a real iPhone or Android phone** (watch the on-screen keyboard and Safari's toolbar).

**Outlines on the 3D model:** always on, at a fixed weight of 0.6 px (`DEFAULT_OUTLINE` in `Pallet3DLive.jsx`). The owner had the switch and line-weight slider removed on 7 Oct 2026 and chose 0.6. Each real part draws its 12 edges with drei's `Line` (wide lines, so the weight is in screen pixels and constant at any zoom; hidden edges stay hidden). Ghost parts are not outlined, and the PDFs are not affected. Pass `outline={null}` to `Pallet3DLive` to draw the model without them. The old `palletOutlines` storage key is no longer read.

**Build progress:** each Build section heading carries a `StatusMark` (far right of the heading row: a circle whose outline fills clockwise as the section is completed, then becomes a bright green ticked circle; completion plays the same click-and-ripple as the padlock in `LockIcon.css`, so keep the two in step), driven by `buildProgress`. Fields with nothing chosen get `data-empty` and render hollow with a dashed outline. The price card lists what's left ("Still to choose: top boards and bearers"). Bottom boards count as required, matching `liveQuote.isComplete`; the owner hasn't confirmed whether some pallets have none.

**3D ghosts:** in `Pallet3DLive.jsx`, any part without a timber size yet is drawn as a faint see-through block with an outline (`GhostBoard`): boards with a count but no size, a slab where a deck has no boards, and three bearers where none are set. Ghosts sit on their own three.js layer so the ground shadow ignores them.

**Same-timber shortcut:** while a Build section has no timber, it offers a one-click "Use X, same as bottom boards" button (`sameTimberButton`).

**Quote tab:** three labelled sections read top to bottom (`.q-section` and the other `q-` classes in `Workbench.css`): **Customer** (name and their reference, one per line), **Cost per pallet** (each material with its count, size and length, in as few words as possible: no "long", and no board gaps, at the owner's request; then Materials, Labour and Markup adding up to a bold Price per pallet) and **Order total** (the only tinted card: pallets stepper, total ex GST, GST, and the large total). Money sits in one right-aligned column. Warnings appear inside the section they relate to. Redone on 5 Oct 2026 because the owner found the old striped list and single grey totals block hard to read.

**History tab:** saved quotes are grouped by what needs doing next, in folding sections (`Fold`, ids `historyChase`, `historyDrafts`, `historyWaiting`, `historyDecided`): **To chase** (sent and flagged), **Drafts**, **Waiting on customer** (sent, still valid) and **Decided** (accepted and lost, folded by default, split by month). Each heading shows a count and a total ex GST; Decided shows the value of accepted quotes only. Empty sections are hidden, and a search opens every section that has a match. The grouping lives in `src/utils/quotes.js` (`groupQuotes`, `quotesByMonth`, `quotesTotal`, `sentSummary`, all tested). This replaced the status chips (All, Draft, Sent, Accepted, Lost) on 4 Oct 2026. Each quote is a compact row (customer and total; number, size, quantity and reference); tapping it expands the status picker, Open, Duplicate and Delete, one row at a time. Sent quotes also show how long ago they went out and how long they stay valid, with one-tap **Accepted** and **Lost** buttons on the row (`quickStatus`); a banner offers Undo, which puts the quote back exactly as it was. Sent quotes that need chasing get a tag from `quoteAttention()`: "Follow up" after 7 days with no answer, "Expired" once past the valid-until date. Quotes record `sentAt` and `validUntil` when they're marked sent, whether by exporting the customer PDF or by hand. Not built yet (mocked up only): a "By customer" view and a list-plus-details layout for wide screens.

**Gross profit on the price card:** an eye button on the card shows or hides a "Gross profit $X · Y% margin" line (markup × quantity). It's off by default and remembered in `palletShowProfit`, because that card is the part of the screen most likely to be shown to a customer. The button only appears once a markup is set. It's gross profit: freight and overheads aren't in the cost yet.

**Editable timber list:** the list of timber types and sizes is part of the price list (`prices.timberTypes`), not fixed. "Edit list" on the Prices tab lets a business add, rename and remove timber types and board or bearer sizes, and reset to the standard list. The rules live in `src/utils/priceList.js` (tested in `priceList.test.js`): an untouched list is the bundled `timber-prices.json` with saved prices laid over it; once edited (`listEdited: true`) it's kept exactly as saved. Edits are saved with "Save prices". If a chosen timber or size is removed, or a preset names one that no longer exists, an effect clears that choice. Quote snapshots carry their own list, so old quotes still open correctly.

**Logo:** `business.logo` is a data URL (shrunk on upload by `readLogo`, under about 350 KB) stored in `palletBusiness` and shown beside the business name on the customer PDF, capped at 10 mm tall so the quote still fits one page.

**Terms and privacy pages:** `terms/index.html` and `privacy/index.html` are extra Vite pages that share the landing styles (`src/landing/legal.js`, `legal.css`). They're linked from the landing footer and from the foot of the Prices tab. The operator's legal name, ABN, contact email and governing state live in `src/landing/operator.js`; anything blank shows on the page as a highlighted "[to be confirmed]". While any are blank, both pages also show a "Draft" banner at the top. The owner has chosen to leave them as placeholders for now. **Don't put these pages live until those are filled in and the owner has had the wording reviewed.** The wording was drafted by an AI, not a lawyer. The privacy page's claims (no accounts, no cookies, no analytics, no outside requests, data only in the browser) were checked against the app; update the page before adding anything that changes them, such as accounts or analytics.

**Country (added 7 Oct 2026, so the app can be used in New Zealand):** the app asks "Where do you quote?" (Australia or New Zealand) in a small dialog the first time it opens on a device with no saved country, because the GST rate affects every figure and not everyone opens the business details. The owner asked for this to be the first thing a user does. It is asked once, the answer is saved in `palletBusiness.country` (and syncs), the guessed country is preselected in a dropdown with a Continue button, and it is skipped in demonstration mode. The dropdown shows each country's flag beside its name (`CountrySelect.jsx`, flags drawn as SVG in `Flag.jsx` because flag emoji do not show on Windows); the owner asked for a dropdown with flags rather than two large buttons. The same choice can be changed later in "Labour, markup and GST" on the Prices tab, above the GST rate (`src/utils/region.js`, tested in `region.test.js`). The `tools/landing-media` scripts open the app fresh, so they now need to answer the dialog (click `[data-field="country-continue"]`) or seed a country first. It decides two things: the standard GST rate (10% or 15%) and what the tax number is called ("ABN", or "GST number" on screen and "GST No." on the customer PDF). Changing country moves the GST rate to the new country's standard rate and saves it straight away, unless the business had set its own rate, which is left alone. A device with nothing saved yet starts as New Zealand if its time zone is `Pacific/Auckland` or `Pacific/Chatham`; business details saved before this existed are treated as Australian. The number is still stored as `business.abn`. Currency and dates are unchanged (`en-AU` formatting is the same in NZ). To add a country, add an entry to `REGIONS`. Not done: the legal pages still cite Australian law only, and the subscription is priced in AUD only.

**Price lock:** timber and nail prices are locked against accidental edits, each with its own padlock. Labour, markup and GST share one padlock in their section head (lock id `pricing`). Everything starts locked on each visit.

## 5a. Accounts and online storage (live at palletquoter.com, not yet on `main`)

The owner wants accounts with online storage on **Supabase**, hosted on **Vercel**, starting on the free plans. The code is complete on the working branch and is **off by default**: with no `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at build time (see `.env.example`) there is no account button, the Supabase library is never downloaded, and the app is local-only exactly as before. The GitHub Pages build has no such settings.

**Decisions made with the owner**
- Sign-in by emailed link, with Google sign-in to be added (`VITE_AUTH_GOOGLE=1` shows the button once Google is set up in Supabase). No passwords.
- Signing in is optional. The app stays local-first and works offline; an account adds backup and syncing.
- Data belongs to a **business**, not a person (`businesses` + `business_members`), so staff can be added later. For now each person gets one business and is its owner.
- Database in Supabase's Sydney region. Everything under the owner's own accounts. The owner is creating a **new Supabase organisation** for this (not the existing "test org").

**Where things are**
- `supabase/migrations/` : tables, row-level security, the "newest change wins" trigger, and the `ensure_business()` function, and a rule letting an owner delete their own business row (which removes everything under it). Apply these to the Supabase project in order.
- `src/sync/merge.js` : the rules (newest change wins; deletions travel as tombstones; duplicate quote numbers from two offline devices are renumbered). Pure and tested.
- `src/sync/engine.js` : brings a device and the account into step. Takes a `storage` and a `remote`, so it runs against fakes in tests.
- `src/sync/supabaseRemote.js` : the thin Supabase adapter. `src/sync/index.js` : sign-in, sign-out, background syncing, and the state the account screen shows.
- The app calls `noteLocalChange(key)` from `writeStorage` and `noteQuoteDeleted(id)` when a quote is deleted; `setOnApplied` reloads React state after synced data lands.
- Extra storage keys: `palletSyncMeta` (link to the account, per-document change times, pending deletions) and `palletPreSyncBackup` (what was on a device before an account's data first replaced it).

**How it was tested**
- `npm test` : 62 tests, including two simulated devices syncing through a fake online side.
- `supabase/tests/run_local.sh` : applies the migrations to a throwaway local Postgres and tries to break the privacy rules as another signed-in person and as a visitor.
- `supabase/tests/run_api_local.sh` : the same through PostgREST (the data API Supabase uses) with the real `supabase-js` client and the real sync engine.
- Two real browsers signed in to one account against that local API: data, a status change and a deletion all travelled between them.
- **Not yet tested, because it needs the real Supabase project:** the emailed sign-in link itself, Google sign-in, and the migrations on Supabase's own Postgres.

**To switch it on**
1. **Done (3 Oct 2026):** Supabase project `pallet-quote` (ref `wxheqxppnpftukedrdhl`, region `ap-southeast-2`, URL `https://wxheqxppnpftukedrdhl.supabase.co`) in the owner's organisation "Pallet Qoute" (name has a typo, harmless). The design in `supabase/migrations/` was applied in several smaller migrations (the Supabase connector cancels SQL it sees as destructive, so one big file would not go through). Checked on the real database: visitors are blocked from every table; a signed-in stranger sees nothing and cannot insert. The security advisor shows one expected warning (`ensure_business` is a security-definer function signed-in users may call; that is its purpose). Deleting online data is done by the owner deleting their `businesses` row, allowed by a row-level rule, not by a function.
2. **Done:** Supabase Authentication URL settings point at `https://palletquoter.com` (redirects `https://palletquoter.com/**` and the `vercel.app` address).
3. **Done:** Vercel project `pallet-quote` (id `prj_ghC4t0qv8M2toZM1pGGEAH2v0wol`, owner's Hobby account) linked to the GitHub repo, with the two `VITE_SUPABASE_*` variables. Addresses: **https://palletquoter.com** (owner's domain, registered and DNS at Cloudflare: A `@` 76.76.21.21 and CNAME `www` cname.vercel-dns.com, both "DNS only"), `www` forwards to it, plus `pallet-quote-rouge.vercel.app`. The first deployment was made from the working branch. **Vercel's production branch is `main`, so a push to `main` redeploys the site from `main`**; until the working branch is merged, `main` has no accounts code.
3a. **Done:** sign-in emails go through Resend (domain `palletquoter.com` verified, sending-only key held in Supabase SMTP settings, sender `signin@palletquoter.com`); email limit raised from 2 to 30 an hour. Supabase organisation is on the Pro plan.
3c. **Done:** `contact@palletquoter.com` forwards to the owner's Gmail through Cloudflare Email Routing (receive-only; MX and SPF on the root name, managed by Cloudflare, alongside Resend's records on `send.` and `resend._domainkey`). It is the contact address on the legal pages. Owner tested forwarding and sign-in emails after the change.
3b. **Tested by the owner on the real setup (3 Oct 2026):** sign-up, emailed link, sign-in on a laptop and a phone, data uploading and appearing on the second device. Not yet tested there: a deletion or status change travelling between devices, Google sign-in (not set up).
4. The terms and privacy pages switch to the accounts wording automatically when `VITE_SUPABASE_URL` is set. The operator details in `src/landing/operator.js` are filled in (sole trader Saverio Curcio, ABN 53 795 324 705, Victoria), so the draft banner no longer shows.
5. Before real customers: custom email sending (Supabase's built-in sender is rate-limited), the paid Supabase plan for backups and no pausing, Vercel's paid plan for commercial use, and a lawyer's review of the legal pages.

## 6. Design rules the owner has set

- **Landing page: leave the layout alone.** On 3 Oct 2026 three redesigns were tried and the owner rejected all of them (a scroll-driven mock-up of the app, a pinned window of real screenshots that zoomed, and an Apple-style stage of separately animated pieces) and asked for the original back. The page is the original design in the blue accent: hero with the self-building isometric pallet and price ticket, the three pain points, four feature blocks with real screenshots, the "Try it" mini calculator, the detail list, questions and the final call to action. Don't restructure it without being asked. The rejected versions are in the branch history (commits e908d1b, bd8e89c, 8848d61) if any part is wanted later. Landing copy that depends on accounts uses `data-accounts="on|off"` like the legal pages (two passages).
- **Crates "in development" section (added 7 Oct 2026 at the owner's request):** `#crates` on the landing page, between "What the price includes" and the plans (`.soon` styles in `landing.css`). It says crate quoting is being worked on, lists what is planned, states plainly that it is not available and has no release date, and asks crate builders to email. Nothing for crates is built yet (see section 7), so keep the wording as a plan, not a feature, and update or remove it if plans change.
- Clean, sleek look that doesn't read as AI-made: soft grey canvas, white rounded cards, pill tabs and buttons, blue accent (`--accent` `#2563d9`, dark mode `#6ea3f7`), Outfit font. Green is reserved for status and money (`--ready` / `--ready-soft`: completed ticks, cost badges, profit, accepted status, synced marker); don't use it for buttons or links. The owner rejected a stencil font as "tacky".
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
