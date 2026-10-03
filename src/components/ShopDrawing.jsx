import React from 'react'

/*
  Shop drawing for the printed quote.

  One SVG "sheet", 1000 units wide, printed at exactly 160 mm wide
  (see .shop-drawing in PrintableQuote.css), so 1 unit = 0.16 mm on paper.
  Plan, front and side elevations share one standard scale and are laid out
  in third-angle projection (AS 1100): plan above the front elevation, right
  side elevation beside it. An isometric view sits top right.

  Pallet axes: x across the width (deck boards side by side),
  z along the length (deck boards run this way), y up.
*/

const SHEET_W = 1000
const MM_PER_UNIT = 0.16
const SCALES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200]

// Line weights (sheet units; 1 unit = 0.16 mm when printed)
const LW = {
  primary: 1.15,    // nearest visible edges / profile
  visible: 0.7,     // other visible edges
  secondary: 0.45,  // visible but further back (seen through gaps)
  hidden: 0.45,     // hidden edges, dashed
  thin: 0.3         // dimensions, extension and leader lines
}

const HIDDEN_DASH = '5 3'
const INK = '#000'
// Colour of detail callouts (the box on the elevation and its matching marker)
const CALLOUT = '#c0392b'
// Secondary lettering: scales, labels, notes
const SOFT = '#555'
const TONE = { top: '#ffffff', left: '#eeeeee', right: '#d9d9d9', end: '#e6e6e6', back: '#f4f4f4' }
const FONT = "'Outfit Variable', Arial, Helvetica, sans-serif"

const r1 = (n) => Math.round(n * 10) / 10
// Dimension text: whole mm, or one decimal when it matters
const dimText = (mm) => {
  const v = r1(mm)
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

// ---------- Geometry ----------

// Boards across the width, flush to both edges, leaders on the outside
function deck(count, boardW, boardT, leaderW, leaderT, gap) {
  const out = []
  let x = 0
  for (let i = 0; i < count; i++) {
    const leader = leaderW > 0 && count >= 2 && (i === 0 || i === count - 1)
    const w = leader ? leaderW : boardW
    out.push({ x, w, t: leader ? leaderT : boardT, leader })
    x += w + gap
  }
  return out
}

// Bearers along the length, flush to both ends
function bearerLayout(count, thickness, length) {
  if (count <= 0) return []
  if (count === 1) return [(length - thickness) / 2]
  const gap = (length - count * thickness) / (count - 1)
  return Array.from({ length: count }, (_, i) => i * (thickness + gap))
}

// ---------- Drawing primitives ----------

// Linear dimension with oblique tick terminators.
// a, b: points on the object; off: offset of the dimension line (signed,
// perpendicular to a->b). label defaults to the measured length in mm.
function Dim({ a, b, off, mm, label, s, size = 9.5, textSide = 1 }) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len
  const nx = -uy, ny = ux // normal
  const p1 = [a[0] + nx * off, a[1] + ny * off]
  const p2 = [b[0] + nx * off, b[1] + ny * off]
  const gap = 3, over = 4 * Math.sign(off || 1)
  const ext = (p, q) => [
    p[0] + nx * gap * Math.sign(off || 1), p[1] + ny * gap * Math.sign(off || 1),
    q[0] + nx * over, q[1] + ny * over
  ]
  const e1 = ext(a, p1), e2 = ext(b, p2)
  const tick = (p) => {
    const t = 2.8
    // 45 degree tick relative to the dimension line
    const tx = (ux + nx) * t * 0.7071, ty = (uy + ny) * t * 0.7071
    return <line x1={p[0] - tx} y1={p[1] - ty} x2={p[0] + tx} y2={p[1] + ty} stroke={INK} strokeWidth={LW.secondary} />
  }
  const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
  const angle = Math.atan2(dy, dx) * 180 / Math.PI
  const upright = angle > 90 || angle <= -90 ? angle + 180 : angle
  // Text sits on the outer side of the dimension line
  const tOff = (size * 0.45 + 3) * textSide * (upright === angle ? -1 : 1)
  const tx = mid[0] + nx * tOff * Math.sign(off || 1) * (upright === angle ? 1 : -1)
  const ty = mid[1] + ny * tOff * Math.sign(off || 1) * (upright === angle ? 1 : -1)
  const text = label ?? dimText(mm ?? len / s)
  // Short dimensions: lift the text onto a second row, clear of its neighbours
  const fits = len > text.length * size * 0.55 + 6
  const outward = Math.sign(off || 1)
  const tPos = fits ? [tx, ty] : [tx + nx * outward * (size + 3), ty + ny * outward * (size + 3)]
  return (
    <g>
      <line x1={e1[0]} y1={e1[1]} x2={e1[2]} y2={e1[3]} stroke={INK} strokeWidth={LW.thin} />
      <line x1={e2[0]} y1={e2[1]} x2={e2[2]} y2={e2[3]} stroke={INK} strokeWidth={LW.thin} />
      <line x1={p1[0] - ux * 4} y1={p1[1] - uy * 4} x2={p2[0] + ux * 4} y2={p2[1] + uy * 4} stroke={INK} strokeWidth={LW.thin} />
      {tick(p1)}{tick(p2)}
      <text x={tPos[0]} y={tPos[1]} fontSize={size} fontWeight="400" letterSpacing="0.2" fontFamily={FONT} textAnchor="middle" dominantBaseline="central"
        transform={`rotate(${upright} ${tPos[0]} ${tPos[1]})`} fill={INK}>{text}</text>
    </g>
  )
}

// Part tag: letter in a circle with a leader line to the part
function Tag({ letter, at, to, r = 7.5 }) {
  const dx = to[0] - at[0], dy = to[1] - at[1]
  const d = Math.hypot(dx, dy) || 1
  const sx = at[0] + dx / d * r, sy = at[1] + dy / d * r
  return (
    <g>
      <line x1={sx} y1={sy} x2={to[0]} y2={to[1]} stroke={INK} strokeWidth={LW.thin} />
      <circle cx={to[0]} cy={to[1]} r={1.2} fill={INK} />
      <circle cx={at[0]} cy={at[1]} r={r} fill="#fff" stroke={INK} strokeWidth={LW.secondary} />
      <text x={at[0]} y={at[1] + 0.5} fontSize={8.5} fontWeight="500" fontFamily={FONT} textAnchor="middle" dominantBaseline="central">{letter}</text>
    </g>
  )
}

// View title in the manner of an architectural sheet: spaced capitals over a
// single hairline of fixed length, with the scale beneath in small grey capitals.
const TITLE_RULE = 150
function ViewTitle({ x, y, title, sub }) {
  return (
    <g fontFamily={FONT}>
      <text x={x} y={y} fontSize={10} fontWeight="500" letterSpacing="1.6">{title}</text>
      <line x1={x} y1={y + 6} x2={x + TITLE_RULE} y2={y + 6} stroke={INK} strokeWidth={LW.secondary} />
      {sub && <text x={x} y={y + 18} fontSize={7.5} letterSpacing="1.1" fill={SOFT}>{sub.toUpperCase()}</text>}
    </g>
  )
}

// Third-angle projection symbol (AS 1100 / ISO 128)
function ThirdAngleSymbol({ x, y, w = 34 }) {
  const h = w * 0.42
  return (
    <g stroke={INK} fill="none" strokeWidth={LW.secondary}>
      <path d={`M${x} ${y + h * 0.25} L${x + w * 0.45} ${y} L${x + w * 0.45} ${y + h} L${x} ${y + h * 0.75} Z`} />
      <circle cx={x + w * 0.8} cy={y + h / 2} r={h / 2} />
      <circle cx={x + w * 0.8} cy={y + h / 2} r={h / 4.5} />
      <line x1={x - 3} y1={y + h / 2} x2={x + w + 3} y2={y + h / 2} strokeWidth={LW.thin} strokeDasharray="6 2 1 2" />
    </g>
  )
}

// ---------- Main sheet ----------

// Zig-zag break line (vertical) used where the detail view is cut off
function BreakLine({ x, y0, y1 }) {
  const mid = (y0 + y1) / 2, a = 5
  return (
    <path d={`M${x} ${y0 - 8} L${x} ${mid - 7} L${x + a} ${mid - 3} L${x - a} ${mid + 3} L${x} ${mid + 7} L${x} ${y1 + 8}`}
      fill="none" stroke={INK} strokeWidth={LW.thin} />
  )
}

function pickScale(maxS) {
  for (const d of SCALES) if (1 / (d * MM_PER_UNIT) <= maxS) return d
  return SCALES[SCALES.length - 1]
}

// ---------- Main sheet ----------

function ShopDrawing({ q, quantity, today, parts }) {
  const W = q.palletWidth, L = q.palletLength
  if (!(W > 0 && L > 0)) return null

  const topBoardW = q.topBoardWidth || 100
  const topBoardT = q.topBoardThickness || 19
  const botBoardW = q.bottomBoardWidth || 100
  const botBoardT = q.bottomBoardThickness || 19
  const topLeaderW = q.topLeaderCount > 0 ? q.topLeaderWidth : 0
  const topLeaderT = q.topLeaderCount > 0 ? q.topLeaderThickness : 0
  const botLeaderW = q.bottomLeaderCount > 0 ? q.bottomLeaderWidth : 0
  const botLeaderT = q.bottomLeaderCount > 0 ? q.bottomLeaderThickness : 0
  const bearerH = q.bearerWidth || 100   // bearers stand on edge
  const bearerT = q.bearerThickness || 38

  const topGap = Math.max(0, q.topGapSize || 0)
  const botGap = Math.max(0, q.bottomGapSize || 0)
  const top = deck(q.numberOfTopBoards, topBoardW, topBoardT, topLeaderW, topLeaderT, topGap)
  const bot = deck(q.numberOfBottomBoards, botBoardW, botBoardT, botLeaderW, botLeaderT, botGap)
  const bearers = bearerLayout(q.numberOfBearers, bearerT, L)
  const hasBearers = bearers.length > 0

  const botT = bot.length ? Math.max(...bot.map(b => b.t)) : 0
  const topT = top.length ? Math.max(...top.map(b => b.t)) : 0
  const yBearer0 = botT
  const yBearer1 = botT + (hasBearers ? bearerH : 0)
  const H = yBearer1 + topT

  const tag = (kind) => parts.find(p => p.kind === kind)?.ref

  // ----- Scale: largest standard scale that fits the sheet -----
  const leftM = 92, colGap = 118, rightM = 38
  const denom = pickScale(Math.min((SHEET_W - leftM - colGap - rightM) / (W + L), 470 / (L + H)))
  const s = 1 / (denom * MM_PER_UNIT)
  const Wp = W * s, Lp = L * s, Hp = H * s

  // ----- Layout: third-angle projection + detail + title block -----
  // Two columns. Everything in the left column starts on the pallet's left edge (planX);
  // everything in the right column starts on the side elevation's left edge (sideX).
  //  [ PLAN           ] [ ISOMETRIC      ]
  //  [ FRONT ELEVATION] [ SIDE ELEVATION ]
  //  [ DETAIL 1       ] [ NOTES / TITLE  ]
  const planX = leftM, planY = 58
  const rowB = planY + Lp + 126
  const frontX = planX, frontY = rowB
  const sideX = planX + Wp + colGap, sideY = rowB
  const rightColX = sideX
  // Right edge of the right column: the end of the side elevation, or wide enough for the title block
  const rightColX1 = Math.min(SHEET_W - 20, Math.max(sideX + Lp, sideX + 320))
  const axoX0 = rightColX, axoX1 = rightColX1
  const axoY0 = 26, axoY1 = planY + Lp + 40
  const rowC = rowB + Hp + 112

  // Detail: end profile at a larger scale, cut off with a break line
  // Show the first top board, the gap and part of the next board
  const detX = planX, detY = rowC + 26
  const detAvailW = rightColX - detX - 180   // leave room for the leader notes
  const cutTarget = Math.min(W, Math.max(
    top.length >= 2 ? top[1].x + Math.min(top[1].w, 40) : (top[0]?.w || 100) + 40,
    (bot[0]?.w || 0) + 30, 120))
  const detailDenom = pickScale(Math.min(detAvailW / cutTarget, 190 / H))
  const ds = 1 / (detailDenom * MM_PER_UNIT)
  const xCut = Math.min(W, cutTarget, detAvailW / ds)
  const detH = H * ds
  const sheetH = Math.max(detY + detH + 76, rowC + 210)

  // ======== PLAN (looking down) ========
  const px = (x) => planX + x * s, pz = (z) => planY + z * s
  const planTags = []
  {
    const b = top.find(bb => !bb.leader)
    if (b && tag('top')) planTags.push({ letter: tag('top'), x: b.x + b.w / 2, z: L * 0.78 })
    if (topLeaderW > 0 && tag('topLeader')) planTags.push({ letter: tag('topLeader'), x: top[top.length - 1].x + top[top.length - 1].w / 2, z: L * 0.9 })
    if (hasBearers && tag('bearer')) {
      // Point at bearer where it shows between two top boards
      const gi = Math.max(0, Math.floor(top.length / 2) - 1)
      const gx = top.length >= 2 ? top[gi].x + top[gi].w + topGap / 2 : W / 2
      const z = bearers[bearers.length - 1]
      planTags.push({ letter: tag('bearer'), x: gx, z: z + bearerT / 2 })
    }
  }
  const plan = (
    <g>
      <defs>
        <clipPath id="clip-topboards">
          {top.map((b, i) => <rect key={i} x={px(b.x)} y={pz(0)} width={b.w * s} height={Lp} />)}
        </clipPath>
      </defs>
      {/* Bottom boards: seen only through the gaps, so drawn light */}
      {bot.map((b, i) => (
        <rect key={`pb${i}`} x={px(b.x)} y={pz(0)} width={b.w * s} height={Lp} fill={TONE.back} stroke={INK} strokeWidth={LW.secondary} />
      ))}
      {/* Bearers: visible between top boards */}
      {bearers.map((z, i) => (
        <rect key={`pr${i}`} x={px(0)} y={pz(z)} width={Wp} height={bearerT * s} fill={TONE.left} stroke={INK} strokeWidth={LW.visible} />
      ))}
      {/* Top boards (nearest to the viewer: heaviest line) */}
      {top.map((b, i) => (
        <rect key={`pt${i}`} x={px(b.x)} y={pz(0)} width={b.w * s} height={Lp} fill="#fff" stroke={INK} strokeWidth={LW.primary} />
      ))}
      {/* Bearers hidden under the top boards */}
      <g clipPath="url(#clip-topboards)" stroke={INK} strokeWidth={LW.hidden} strokeDasharray={HIDDEN_DASH}>
        {bearers.map((z, i) => (
          <g key={`ph${i}`}>
            <line x1={px(0)} y1={pz(z)} x2={px(W)} y2={pz(z)} />
            <line x1={px(0)} y1={pz(z + bearerT)} x2={px(W)} y2={pz(z + bearerT)} />
          </g>
        ))}
      </g>
      {/* Nail positions */}
      {top.map((b, i) => bearers.map((z, j) => [0.25, 0.75].map((f, n) => (
        <circle key={`pn${i}-${j}-${n}`} cx={px(b.x + b.w * f)} cy={pz(z + bearerT / 2)} r={1.1} fill={INK} />
      ))))}
      {/* Centre lines */}
      <g stroke={INK} strokeWidth={LW.thin} strokeDasharray="14 3 2 3">
        <line x1={px(W / 2)} y1={pz(0) - 8} x2={px(W / 2)} y2={pz(L) + 8} />
        <line x1={px(0) - 8} y1={pz(L / 2)} x2={px(W) + 8} y2={pz(L / 2)} />
      </g>

      {/* Overall width, then board / gap chain */}
      <Dim a={[px(0), pz(0)]} b={[px(W), pz(0)]} off={-36} mm={W} s={s} />
      {top.length >= 1 && <Dim a={[px(top[0].x), pz(0)]} b={[px(top[0].x + top[0].w), pz(0)]} off={-14} mm={top[0].w} s={s} size={9} />}
      {top.length >= 2 && topGap > 0 && (
        <Dim a={[px(top[0].x + top[0].w), pz(0)]} b={[px(top[1].x), pz(0)]} off={-14} label={`${dimText(topGap)} GAP`} s={s} size={9} />
      )}
      {/* Overall length */}
      <Dim a={[px(W), pz(0)]} b={[px(W), pz(L)]} off={-24} mm={L} s={s} />
      {/* Bearer set-out: chain along the left edge */}
      {hasBearers && (() => {
        const pts = [0]
        bearers.forEach(z => { pts.push(z, z + bearerT) })
        pts.push(L)
        const uniq = [...new Set(pts.map(v => r1(v)))].sort((a, b) => a - b)
        const segs = []
        for (let i = 0; i < uniq.length - 1; i++) if (uniq[i + 1] - uniq[i] > 0.5) segs.push([uniq[i], uniq[i + 1]])
        return segs.map(([a, b], i) => (
          <Dim key={`bd${i}`} a={[px(0), pz(a)]} b={[px(0), pz(b)]} off={20} mm={b - a} s={s} size={9} />
        ))
      })()}

      {/* Part tags, all below the plan */}
      {(() => {
        // Tags sit below the plan, roughly under what they point at, never overlapping
        const sorted = [...planTags].sort((a, b) => a.x - b.x)
        let last = -Infinity
        return sorted.map(t => {
          const x = Math.max(px(t.x), last + 30)
          last = x
          return <Tag key={t.letter} letter={t.letter} at={[x, pz(L) + 44]} to={[px(t.x), pz(t.z)]} />
        })
      })()}

      <ViewTitle x={planX} y={pz(L) + 78} title="TOP" sub={`Scale 1:${denom}`} />
    </g>
  )

  // ======== FRONT ELEVATION (looking along the length) ========
  const fx = (x) => frontX + x * s, fy = (y) => frontY + (H - y) * s
  const bTag = bot.find(b => !b.leader) ? 'bottom' : 'bottomLeader'
  const bBoard = bot.find(b => !b.leader) || bot[0]
  const front = (
    <g>
      {hasBearers && (
        <rect x={fx(0)} y={fy(yBearer1)} width={Wp} height={bearerH * s} fill="#fff" stroke={INK} strokeWidth={LW.primary} />
      )}
      {top.map((b, i) => (
        <rect key={`ft${i}`} x={fx(b.x)} y={fy(yBearer1 + b.t)} width={b.w * s} height={b.t * s} fill={TONE.end} stroke={INK} strokeWidth={LW.primary} />
      ))}
      {bot.map((b, i) => (
        <rect key={`fb${i}`} x={fx(b.x)} y={fy(b.t)} width={b.w * s} height={b.t * s} fill={TONE.end} stroke={INK} strokeWidth={LW.primary} />
      ))}
      <line x1={fx(0) - 14} y1={fy(0)} x2={fx(W) + 14} y2={fy(0)} stroke={INK} strokeWidth={LW.thin} />
      <Dim a={[fx(0), fy(0)]} b={[fx(W), fy(0)]} off={22} mm={W} s={s} />
      <Dim a={[fx(0), fy(0)]} b={[fx(0), fy(H)]} off={-22} mm={H} s={s} />
      {bBoard && tag(bTag) && (
        <Tag letter={tag(bTag)} at={[fx(bBoard.x + bBoard.w / 2) + 40, fy(0) + 46]} to={[fx(bBoard.x + bBoard.w / 2), fy(bBoard.t / 2)]} />
      )}
      {botLeaderW > 0 && tag('bottomLeader') && bTag !== 'bottomLeader' && (
        <Tag letter={tag('bottomLeader')} at={[fx(W) - 30, fy(0) + 46]} to={[fx(W - bot[bot.length - 1].w / 2), fy(bot[bot.length - 1].t / 2)]} />
      )}
      {/* Detail callout on the front elevation: rounded box + numbered marker */}
      {(() => {
        const pad = 7
        const x0 = fx(0) - pad, y0 = fy(H) - pad
        const w = xCut * s + pad * 2, h = Hp + pad * 2
        const bx = x0 + w + 16, by = y0 - 12
        return (
          <g stroke={CALLOUT}>
            <rect x={x0} y={y0} width={w} height={h} rx={4} ry={4} fill="none" strokeWidth={LW.secondary} strokeDasharray="5 3" />
            <line x1={x0 + w} y1={y0 + 4} x2={bx - 6} y2={by + 5} strokeWidth={LW.thin} />
            <circle cx={bx} cy={by} r={7.5} fill="#fff" strokeWidth={LW.secondary} />
            <text x={bx} y={by + 0.5} fontSize={8.5} fontWeight="500" fontFamily={FONT} textAnchor="middle"
              dominantBaseline="central" fill={CALLOUT} stroke="none">1</text>
          </g>
        )
      })()}
      <ViewTitle x={frontX} y={fy(0) + 80} title="SIDE" sub={`Scale 1:${denom}`} />
    </g>
  )

  // ======== SIDE ELEVATION (right side, looking across the width) ========
  const sx = (z) => sideX + z * s, sy = (y) => sideY + (H - y) * s
  const edgeTop = top[top.length - 1], edgeBot = bot[bot.length - 1]
  const side = (
    <g>
      {bearers.map((z, i) => (
        <rect key={`sb${i}`} x={sx(z)} y={sy(yBearer1)} width={bearerT * s} height={bearerH * s} fill={TONE.end} stroke={INK} strokeWidth={LW.primary} />
      ))}
      {/* Bearer edges seen behind, between the end grain */}
      {hasBearers && <line x1={sx(0)} y1={sy(yBearer1)} x2={sx(L)} y2={sy(yBearer1)} stroke={INK} strokeWidth={LW.secondary} />}
      {edgeTop && <rect x={sx(0)} y={sy(yBearer1 + edgeTop.t)} width={Lp} height={edgeTop.t * s} fill="#fff" stroke={INK} strokeWidth={LW.primary} />}
      {topT > (edgeTop?.t || 0) && <line x1={sx(0)} y1={sy(H)} x2={sx(L)} y2={sy(H)} stroke={INK} strokeWidth={LW.secondary} />}
      {edgeBot && <rect x={sx(0)} y={sy(edgeBot.t)} width={Lp} height={edgeBot.t * s} fill="#fff" stroke={INK} strokeWidth={LW.primary} />}
      <line x1={sx(0) - 14} y1={sy(0)} x2={sx(L) + 14} y2={sy(0)} stroke={INK} strokeWidth={LW.thin} />

      <Dim a={[sx(0), sy(0)]} b={[sx(L), sy(0)]} off={22} mm={L} s={s} />
      {bearers.length > 1 && (
        <Dim a={[sx(bearers[0] + bearerT / 2), sy(H)]} b={[sx(bearers[1] + bearerT / 2), sy(H)]} off={-16}
          label={`${dimText(bearers[1] - bearers[0])} CRS`} s={s} size={9} />
      )}
      <ViewTitle x={sideX} y={sy(0) + 80} title="FRONT" sub={`Scale 1:${denom}`} />
    </g>
  )

  // ======== DETAIL 1: end profile at a larger scale ========
  const dx = (x) => detX + x * ds, dy = (y) => detY + (H - y) * ds
  const clipW = xCut * ds
  const detTopBoards = top.filter(b => b.x < xCut)
  const detBotBoards = bot.filter(b => b.x < xCut)
  const tb0 = top[0], tb1 = top[1], bb0 = bot[0]
  const detail = (
    <g>
      <defs>
        <clipPath id="clip-detail"><rect x={detX - 2} y={detY - 4} width={clipW + 2} height={detH + 8} /></clipPath>
        <pattern id="end-grain" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke={INK} strokeWidth="0.2" />
        </pattern>
      </defs>
      <g clipPath="url(#clip-detail)">
        {hasBearers && (
          <rect x={dx(0)} y={dy(yBearer1)} width={W * ds} height={bearerH * ds} fill="#fff" stroke={INK} strokeWidth={LW.primary} />
        )}
        {detTopBoards.map((b, i) => (
          <g key={`dt${i}`}>
            <rect x={dx(b.x)} y={dy(yBearer1 + b.t)} width={b.w * ds} height={b.t * ds} fill="url(#end-grain)" stroke={INK} strokeWidth={LW.primary} />
          </g>
        ))}
        {detBotBoards.map((b, i) => (
          <rect key={`db${i}`} x={dx(b.x)} y={dy(b.t)} width={b.w * ds} height={b.t * ds} fill="url(#end-grain)" stroke={INK} strokeWidth={LW.primary} />
        ))}
        {/* Nails: shank through the board into the bearer */}
        {hasBearers && detTopBoards.map((b, i) => [0.25, 0.75].map((f, n) => (
          <line key={`dn${i}-${n}`} x1={dx(b.x + b.w * f)} y1={dy(yBearer1 + b.t)} x2={dx(b.x + b.w * f)} y2={dy(yBearer1 - Math.min(50, bearerH * 0.55))}
            stroke={INK} strokeWidth={LW.hidden} strokeDasharray={HIDDEN_DASH} />
        )))}
      </g>
      <BreakLine x={dx(xCut)} y0={dy(H)} y1={dy(0)} />
      <line x1={dx(0) - 10} y1={dy(0)} x2={dx(xCut) + 10} y2={dy(0)} stroke={INK} strokeWidth={LW.thin} />

      {/* Thickness chain (left) and overall height */}
      {botT > 0 && <Dim a={[dx(0), dy(0)]} b={[dx(0), dy(botT)]} off={-18} mm={botT} s={ds} size={9} />}
      {hasBearers && <Dim a={[dx(0), dy(yBearer0)]} b={[dx(0), dy(yBearer1)]} off={-18} mm={bearerH} s={ds} size={9} />}
      {topT > 0 && <Dim a={[dx(0), dy(yBearer1)]} b={[dx(0), dy(H)]} off={-18} mm={topT} s={ds} size={9} />}
      <Dim a={[dx(0), dy(0)]} b={[dx(0), dy(H)]} off={-48} mm={H} s={ds} />
      {/* Widths along the top: board, gap, board */}
      {tb0 && <Dim a={[dx(tb0.x), dy(H)]} b={[dx(tb0.x + tb0.w), dy(H)]} off={-14} mm={tb0.w} s={ds} size={9} />}
      {tb1 && tb1.x < xCut && topGap > 0 && <Dim a={[dx(tb0.x + tb0.w), dy(H)]} b={[dx(tb1.x), dy(H)]} off={-14} mm={topGap} s={ds} size={9} />}
      {bb0 && <Dim a={[dx(bb0.x), dy(0)]} b={[dx(bb0.x + bb0.w), dy(0)]} off={16} mm={bb0.w} s={ds} size={9} />}

      {/* Leader notes on the right */}
      {(() => {
        const notes = []
        const nx = dx(xCut) + 26
        if (tb0) notes.push({ y: dy(yBearer1 + tb0.t / 2), to: [dx(Math.min(tb0.x + tb0.w * 0.6, xCut - 5)), dy(yBearer1 + tb0.t / 2)], text: `${parts.find(p => p.kind === (tb0.leader ? 'topLeader' : 'top'))?.ref || ''}  ${tb0.leader ? 'TOP LEADER' : 'TOP BOARD'} ${tb0.w}×${tb0.t}` })
        if (hasBearers) notes.push({ y: dy(yBearer0 + bearerH / 2), to: [dx(Math.min(xCut * 0.8, W - 5)), dy(yBearer0 + bearerH / 2)], text: `${tag('bearer') || ''}  BEARER ${bearerH}×${bearerT} ON EDGE` })
        if (bb0) notes.push({ y: dy(bb0.t / 2), to: [dx(Math.min(bb0.x + bb0.w * 0.6, xCut - 5)), dy(bb0.t / 2)], text: `${parts.find(p => p.kind === (bb0.leader ? 'bottomLeader' : 'bottom'))?.ref || ''}  ${bb0.leader ? 'BOTTOM LEADER' : 'BOTTOM BOARD'} ${bb0.w}×${bb0.t}` })
        if (hasBearers && tb0) notes.push({ y: dy(yBearer1 - Math.min(50, bearerH * 0.55)), to: [dx(tb0.x + tb0.w * 0.75), dy(yBearer1 - Math.min(40, bearerH * 0.45))], text: '2 NAILS PER BOARD PER BEARER' })
        // keep labels at least 13 units apart
        notes.sort((a, b) => a.y - b.y)
        for (let i = 1; i < notes.length; i++) if (notes[i].y - notes[i - 1].y < 14) notes[i].y = notes[i - 1].y + 14
        return notes.map((n, i) => (
          <g key={i}>
            <polyline points={`${n.to[0]},${n.to[1]} ${nx - 8},${n.y} ${nx - 2},${n.y}`} fill="none" stroke={INK} strokeWidth={LW.thin} />
            <circle cx={n.to[0]} cy={n.to[1]} r={1.2} fill={INK} />
            <text x={nx} y={n.y} fontSize={8} letterSpacing="0.6" fontFamily={FONT} dominantBaseline="central">{n.text}</text>
          </g>
        ))
      })()}

      {/* Matching marker so the detail is easy to find from the elevation */}
      <ViewTitle x={detX} y={dy(0) + 50} title="END PROFILE" sub={`Detail 1  ·  Scale 1:${detailDenom}`} />
      <circle cx={detX + TITLE_RULE + 14} cy={dy(0) + 50} r={7.5} fill="#fff" stroke={CALLOUT} strokeWidth={LW.secondary} />
      <text x={detX + TITLE_RULE + 14} y={dy(0) + 50.5} fontSize={8.5} fontWeight="500" fontFamily={FONT} textAnchor="middle" dominantBaseline="central" fill={CALLOUT}>1</text>
    </g>
  )

  // ======== ISOMETRIC ========
  // Painter's algorithm: bottom layer to top, back to front. Each box shows
  // its top, +z (front-left) and +x (front-right) faces.
  const boxes = []
  bot.forEach(b => boxes.push({ x0: b.x, x1: b.x + b.w, y0: 0, y1: b.t, z0: 0, z1: L, layer: 0, key: b.x }))
  bearers.forEach(z => boxes.push({ x0: 0, x1: W, y0: yBearer0, y1: yBearer1, z0: z, z1: z + bearerT, layer: 1, key: z }))
  top.forEach(b => boxes.push({ x0: b.x, x1: b.x + b.w, y0: yBearer1, y1: yBearer1 + b.t, z0: 0, z1: L, layer: 2, key: b.x }))
  boxes.sort((a, b) => a.layer - b.layer || a.key - b.key)

  const C = Math.cos(Math.PI / 6), S = 0.5
  const isoRaw = (x, y, z) => [(x - z) * C, (x + z) * S - y]
  const isoW = (W + L) * C, isoH = (W + L) * S + H
  const k = Math.min((axoX1 - axoX0) / isoW, (axoY1 - axoY0 - 50) / isoH)
  const ox = axoX0 + L * C * k
  const oy = axoY0 + 10 + H * k
  const iso = (x, y, z) => { const [u, v] = isoRaw(x, y, z); return `${ox + u * k},${oy + v * k}` }
  const axo = (
    <g strokeLinejoin="round">
      {boxes.map((b, i) => (
        <g key={i} stroke={INK} strokeWidth={LW.visible}>
          <polygon fill={TONE.left} points={[iso(b.x0, b.y0, b.z1), iso(b.x1, b.y0, b.z1), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)].join(' ')} />
          <polygon fill={TONE.right} points={[iso(b.x1, b.y0, b.z0), iso(b.x1, b.y0, b.z1), iso(b.x1, b.y1, b.z1), iso(b.x1, b.y1, b.z0)].join(' ')} />
          <polygon fill={TONE.top} points={[iso(b.x0, b.y1, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)].join(' ')} />
        </g>
      ))}
      {top.map((b, i) => bearers.map((z, j) => [0.25, 0.75].map((f, n) => {
        const [u, v] = isoRaw(b.x + b.w * f, yBearer1 + b.t, z + bearerT / 2)
        return <ellipse key={`n${i}-${j}-${n}`} cx={ox + u * k} cy={oy + v * k} rx={1.3} ry={0.75} fill={INK} />
      })))}
      {/* Title sits just under the lowest corner of the view, as close as the other titles are to theirs */}
      <ViewTitle x={axoX0} y={oy + (W + L) * S * k + 34} title="ISOMETRIC" sub="Not to scale" />
    </g>
  )

  // ======== Notes & title block ========
  const timber = [...new Set(parts.map(p => p.material).filter(Boolean))].join(', ')
  const notes = [
    'All dimensions in millimetres. Do not scale from drawing.',
    'Deck boards flush to pallet edges with equal gaps.',
    `Fix each deck board to each bearer with 2 nails (${q.totalNails || 0} per pallet).`,
    timber ? `Timber: ${timber}.` : null
  ].filter(Boolean)

  const tbX = rightColX, tbX1 = rightColX1
  const tbY = rowC + 8
  const notesBlock = (
    <g fontFamily={FONT}>
      <text x={tbX} y={tbY + 10} fontSize={10} fontWeight="500" letterSpacing="1.6">NOTES</text>
      <line x1={tbX} y1={tbY + 16} x2={tbX + TITLE_RULE} y2={tbY + 16} stroke={INK} strokeWidth={LW.secondary} />
      {notes.map((n, i) => (
        <g key={i}>
          <text x={tbX} y={tbY + 33 + i * 14} fontSize={8.5} fill={SOFT}>{i + 1}</text>
          <text x={tbX + 14} y={tbY + 33 + i * 14} fontSize={8.5}>{n}</text>
        </g>
      ))}
    </g>
  )

  const tbTop = sheetH - 92
  const cell = (x, y, w, label, value, big) => (
    <g>
      <rect x={x} y={y} width={w} height={big ? 38 : 30} fill="none" stroke={INK} strokeWidth={LW.thin} />
      <text x={x + 7} y={y + 11} fontSize={6} letterSpacing="1.1" fill={SOFT}>{label}</text>
      <text x={x + 7} y={y + (big ? 28 : 23)} fontSize={big ? 11.5 : 9.5} fontWeight={big ? 500 : 400} letterSpacing="0.2">{value}</text>
    </g>
  )
  const tbw = tbX1 - tbX
  const titleBlock = (
    <g fontFamily={FONT}>
      <rect x={tbX} y={tbTop} width={tbw} height={68} fill="none" stroke={INK} strokeWidth={LW.visible} />
      {cell(tbX, tbTop, tbw * 0.72, 'DRAWING', `PALLET ${W} × ${L} × ${r1(H)}`, true)}
      {cell(tbX + tbw * 0.72, tbTop, tbw * 0.28, 'QTY', `${quantity}`, true)}
      {cell(tbX, tbTop + 38, tbw * 0.3, 'DATE', today)}
      {cell(tbX + tbw * 0.3, tbTop + 38, tbw * 0.3, 'SCALE @ A4', `1:${denom}`)}
      {cell(tbX + tbw * 0.6, tbTop + 38, tbw * 0.18, 'UNITS', 'mm')}
      <g>
        <rect x={tbX + tbw * 0.78} y={tbTop + 38} width={tbw * 0.22} height={30} fill="none" stroke={INK} strokeWidth={LW.thin} />
        <ThirdAngleSymbol x={tbX + tbw * 0.78 + (tbw * 0.22 - 34) / 2} y={tbTop + 46} />
      </g>
    </g>
  )

  return (
    <svg className="shop-drawing" viewBox={`0 0 ${SHEET_W} ${sheetH}`} xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily: FONT }} shapeRendering="geometricPrecision">
      {plan}
      {axo}
      {front}
      {side}
      {detail}
      {notesBlock}
      {titleBlock}
    </svg>
  )
}

export default ShopDrawing
