import '../styles/LockIcon.css'

function LockIcon({ isLocked, onClick }) {
  return (
    <button 
      className={`lock-button ${isLocked ? 'locked' : 'unlocked'}`}
      onClick={onClick}
      type="button"
      title={isLocked ? 'Click to unlock and edit' : 'Click to lock'}
    >
      <svg 
        className="lock-icon" 
        width="20" 
        height="20" 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Lock body */}
        <rect 
          x="6" 
          y="11" 
          width="12" 
          height="9" 
          rx="2" 
          className="lock-body"
          stroke="currentColor" 
          strokeWidth="2" 
          fill="currentColor"
          opacity="0.9"
        />
        
        {/* Lock shackle/hook - this will animate */}
        <path 
          className="lock-shackle"
          d={isLocked 
            ? "M8 11V7a4 4 0 0 1 8 0v4" 
            : "M8 11V7a4 4 0 0 1 8 0v4"
          }
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Keyhole */}
        {isLocked && (
          <circle 
            cx="12" 
            cy="15" 
            r="1.5" 
            fill="white"
            opacity="0.8"
          />
        )}
      </svg>
    </button>
  )
}

export default LockIcon

