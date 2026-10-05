import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'

// Phone layout: the 3D pallet fills the screen and the panel is a card that slides up from the
// bottom. Closed, only its grip (handle + price card) shows; open, it covers the whole screen and
// the grip shrinks to a slim bar, so the form gets every pixel.
//
// Position is one number, p: 0 closed, 1 open. It is written straight to CSS variables on the
// workbench while a finger is down, so dragging never re-renders React:
//   --sheet-p      0..1
//   --sheet-y      how far the card is pushed down, in px
//   --peek         height of the part that shows when closed

export const PHONE_QUERY = '(max-width: 900px)'

export function usePhoneLayout() {
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.(PHONE_QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia?.(PHONE_QUERY)
    if (!query) return undefined
    const update = () => setIsPhone(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return isPhone
}

const DRAG_START = 8      // px a finger must travel before it counts as a drag, not a tap
const FLICK = 0.45        // px per ms: faster than this and the direction decides, not the position

const clamp = (n) => Math.min(1, Math.max(0, n))

export function useBottomSheet(enabled) {
  const rootRef = useRef(null)
  const sheetRef = useRef(null)
  const gripRef = useRef(null)
  const [open, setOpenState] = useState(false)
  const openRef = useRef(false)
  const travel = useRef(0)
  const position = useRef(0)
  const swallowClick = useRef(false)

  const apply = useCallback((p) => {
    const root = rootRef.current
    if (!root) return
    position.current = p
    root.style.setProperty('--sheet-p', String(p))
    root.style.setProperty('--sheet-y', `${Math.round((1 - p) * travel.current)}px`)
  }, [])

  const setOpen = useCallback((next) => {
    openRef.current = next
    rootRef.current?.classList.remove('sheet-dragging')
    apply(next ? 1 : 0)
    setOpenState(next)
  }, [apply])

  const measure = useCallback(() => {
    const root = rootRef.current
    const sheet = sheetRef.current
    const grip = gripRef.current
    if (!root || !sheet || !grip) return
    // The grip is slimmer while the card is open, so only its closed height counts as the peek.
    // It is measured again as soon as the card closes.
    if (!root.classList.contains('sheet-open')) {
      const peek = grip.offsetHeight
      travel.current = Math.max(0, sheet.offsetHeight - peek)
      root.style.setProperty('--peek', `${peek}px`)
    }
    if (!root.classList.contains('sheet-dragging')) apply(openRef.current ? 1 : 0)
  }, [apply])

  // Keep the measurements right as the price card grows or the screen turns
  useLayoutEffect(() => {
    if (!enabled) return undefined
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer) {
      if (gripRef.current) observer.observe(gripRef.current)
      if (sheetRef.current) observer.observe(sheetRef.current)
    }
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [enabled, measure])

  // Shared by the grip (pointer) and the body (touch): move with the finger, then settle
  const dragTo = useCallback((p) => {
    rootRef.current?.classList.add('sheet-dragging')
    apply(clamp(p))
  }, [apply])

  const release = useCallback((velocity) => {
    if (Math.abs(velocity) > FLICK) setOpen(velocity < 0)
    else setOpen(position.current > 0.5)
  }, [setOpen])

  // The grip: drag it either way, or tap it. Buttons inside it still work on a tap.
  const gesture = useRef(null)

  const onPointerDown = (e) => {
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return
    gesture.current = { id: e.pointerId, y: e.clientY, from: position.current, dragging: false, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 }
  }

  const onPointerMove = (e) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const dy = e.clientY - g.y
    if (!g.dragging) {
      if (Math.abs(dy) < DRAG_START) return
      g.dragging = true
      g.y = e.clientY
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
      return
    }
    const dt = e.timeStamp - g.lastT
    if (dt > 0) g.velocity = (e.clientY - g.lastY) / dt
    g.lastY = e.clientY
    g.lastT = e.timeStamp
    if (travel.current > 0) dragTo(g.from - dy / travel.current)
  }

  const onPointerEnd = (e) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    gesture.current = null
    if (!g.dragging) return
    // The click that follows a drag must not press whatever was under the finger
    swallowClick.current = true
    setTimeout(() => { swallowClick.current = false }, 0)
    release(e.timeStamp - g.lastT > 120 ? 0 : g.velocity)
  }

  const onClickCapture = (e) => {
    if (!swallowClick.current) return
    swallowClick.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  // A tap on the closed price card (not on one of its controls) opens the panel
  const onClick = (e) => {
    if (openRef.current || e.target.closest('button, input, a, label')) return
    setOpen(true)
  }

  // The rest of the open card: pulling down from the top of the list closes it, like any sheet.
  // Needs a non-passive listener so the page doesn't try to scroll at the same time.
  useEffect(() => {
    const sheet = sheetRef.current
    if (!enabled || !sheet) return undefined
    let g = null

    const start = (e) => {
      g = null
      if (!openRef.current || e.touches.length !== 1) return
      const target = e.target
      if (gripRef.current?.contains(target) || target.closest('input[type="range"]')) return
      const touch = e.touches[0]
      g = { x: touch.clientX, y: touch.clientY, scroller: target.closest('.panel-body'), dragging: false, lastY: touch.clientY, lastT: e.timeStamp, velocity: 0 }
    }

    const move = (e) => {
      if (!g) return
      const touch = e.touches[0]
      const dy = touch.clientY - g.y
      if (!g.dragging) {
        const atTop = !g.scroller || g.scroller.scrollTop <= 0
        const sideways = Math.abs(touch.clientX - g.x) > Math.abs(dy) + DRAG_START
        // Scrolling the list, swiping up or sideways: not ours
        if (!atTop || dy < 0 || sideways || !e.cancelable) {
          if (!atTop || dy < -DRAG_START || sideways || !e.cancelable) g = null
          return
        }
        // At the top and heading down: claim the touch before the browser starts a scroll of its own
        e.preventDefault()
        if (dy < DRAG_START) return
        g.dragging = true
        g.y = touch.clientY
        return
      }
      if (e.cancelable) e.preventDefault()
      const dt = e.timeStamp - g.lastT
      if (dt > 0) g.velocity = (touch.clientY - g.lastY) / dt
      g.lastY = touch.clientY
      g.lastT = e.timeStamp
      if (travel.current > 0) dragTo(1 - dy / travel.current)
    }

    const end = (e) => {
      if (g?.dragging) release(e.timeStamp - g.lastT > 120 ? 0 : g.velocity)
      g = null
    }

    sheet.addEventListener('touchstart', start, { passive: true })
    sheet.addEventListener('touchmove', move, { passive: false })
    sheet.addEventListener('touchend', end)
    sheet.addEventListener('touchcancel', end)
    return () => {
      sheet.removeEventListener('touchstart', start)
      sheet.removeEventListener('touchmove', move)
      sheet.removeEventListener('touchend', end)
      sheet.removeEventListener('touchcancel', end)
    }
  }, [enabled, dragTo, release])

  const gripProps = enabled
    ? { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture, onClick }
    : {}

  return { rootRef, sheetRef, gripRef, gripProps, open, setOpen }
}
