import { useState } from 'react'
import '../styles/LockIcon.css'

// Padlock toggle. The shackle lifts and swings open on unlock and drops
// back in on lock; the body gives a small "click". Animations only run
// when the user toggles it, never when the list first appears.
function LockIcon({ isLocked, onClick, label = 'price' }) {
  const [clicks, setClicks] = useState(0)

  const handleClick = (e) => {
    setClicks(c => c + 1)
    onClick?.(e)
  }

  // Alternate the class so the "click" keyframe restarts on every toggle
  const pulse = clicks === 0 ? '' : clicks % 2 ? 'pulse-a' : 'pulse-b'

  return (
    <button
      className={`lock-button ${isLocked ? 'locked' : 'unlocked'} ${pulse}`}
      onClick={handleClick}
      type="button"
      aria-pressed={!isLocked}
      aria-label={isLocked ? `Unlock ${label} to edit` : `Lock ${label}`}
      title={isLocked ? 'Unlock to edit' : 'Lock'}
    >
      <svg className="lock-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          className="lock-shackle"
          d="M8 11.5V8a4 4 0 0 1 8 0v3.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect className="lock-body" x="5" y="11" width="14" height="10" rx="3" fill="currentColor" />
        <circle className="lock-keyhole" cx="12" cy="16" r="1.4" />
      </svg>
    </button>
  )
}

export default LockIcon
