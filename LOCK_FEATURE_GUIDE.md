# Lock/Unlock Feature Guide

## Overview
Each price field in the Price Editor now has a lock/unlock toggle that prevents accidental price changes. This adds an extra layer of security for your pricing data.

## Features

### 🔒 Individual Field Locks
- Every price input (boards, bearers, and nails) has its own lock icon
- Click the lock icon to toggle between locked (🔒) and unlocked (🔓) states
- Locked fields cannot be edited and have a distinctive red-tinted background
- Unlocked fields have a normal white background and can be edited freely

### 🎬 Animated Lock Icon
The custom lock icon features a smooth animation when toggling:
- **When unlocking**: The lock's shackle swings open to the side with a realistic swaying motion
- **When locking**: The shackle swings back closed smoothly
- **Visual feedback**: The lock changes color (red for locked, green for unlocked)

### 💾 Persistent Lock States
- Lock states are automatically saved to browser localStorage
- When you reload the page, all your lock settings are remembered
- By default, all fields start locked for safety

### 🔓 Bulk Unlock Option
- Use the "Unlock All Prices" button to quickly unlock all fields for editing
- Use the "Lock All Prices" button to re-lock everything at once

## How to Edit Prices

1. **Navigate to the Price Editor tab**
2. **Click the lock icon** next to the price you want to edit
   - The lock will swing open (animation plays)
   - The input field background changes from red to white
3. **Enter the new price** in the unlocked field
4. **Click the lock icon again** to lock the field (optional but recommended)
5. **Click "Save Changes"** to persist your updates

## Customization

### Editing Lock Animation
The lock animation is defined in `/src/styles/LockIcon.css`. Key animations:

```css
@keyframes swingOpen {
  /* Adjust these values for different swing behavior */
  0% {transform: rotate(0deg);}
  30% {transform: rotate(-45deg);}
  50% {transform: rotate(-50deg);}
  70% {transform: rotate(-42deg);}
  85% {transform: rotate(-46deg);}
  100% {transform: rotate(-45deg);}
}
```

### Editing Lock Colors
Lock colors can be modified in `/src/styles/LockIcon.css`:

```css
/* Locked State - currently red */
.lock-button.locked {
  color: var(--danger-color);
}

/* Unlocked State - currently green */
.lock-button.unlocked {
  color: var(--success-color);
}
```

### Editing Disabled Input Styling
Locked input appearance can be customized in `/src/styles/PriceEditor.css`:

```css
.price-input:disabled {
  background-color: #fef2f2;  /* Light red background */
  color: #991b1b;              /* Dark red text */
  border-color: #fca5a5;       /* Red border */
  opacity: 0.8;
}
```

## Technical Details

### Component Structure
- **LockIcon.jsx**: SVG-based animated lock icon component
- **PriceEditor.jsx**: Main price editor with lock state management
- **LockIcon.css**: Lock-specific animations and styles
- **PriceEditor.css**: Overall editor and input field styling

### Lock State Management
Lock states are managed using React's `useState` hook with a `Set` data structure:
- Each field has a unique ID (e.g., `"pine-board-1", "oak-bearer-2", "nails"`)
- The `Set` stores all currently locked field IDs
- Lock/unlock operations add/remove IDs from the Set
- Changes are automatically persisted to `localStorage` as JSON arrays

### Animation Details
- **Duration**: 0.6 seconds for unlock, 0.4 seconds for lock
- **Easing**: `ease-out` for natural motion
- **Transform origin**: Left hinge point of the shackle (coordinates: 8px, 7px)
- **Rotation**: Shackle rotates -45 degrees when open, with overshoot for realism

## Troubleshooting

### Locks Not Saving
If lock states don't persist across page reloads:
- Check browser console for localStorage errors
- Ensure your browser allows localStorage for this site
- Try clearing browser cache and reload

### Animation Not Playing
If the lock animation doesn't play:
- Check that `/src/styles/LockIcon.css` is loaded
- Inspect the element in browser DevTools to verify CSS is applied
- Try hard-refresh (Cmd/Ctrl + Shift + R)

### Can't Unlock Fields
If you can't unlock fields:
- Check that JavaScript is enabled in your browser
- Look for errors in the browser console
- Try the "Unlock All Prices" button as an alternative

