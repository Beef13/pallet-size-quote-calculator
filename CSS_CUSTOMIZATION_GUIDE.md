# CSS Customization Cheat Sheet

Quick reference guide for customizing the design of your Quote Calculator.

---

## 🎨 Color Customization

### File: `src/index.css`

All colors are defined as CSS variables in one place. Change these to instantly update the entire app!

```css
:root {
  /* Primary Colors */
  --primary-color: #2563eb;        /* Main blue - buttons, headers */
  --primary-hover: #1e40af;        /* Darker blue - hover states */
  --secondary-color: #64748b;      /* Gray - secondary buttons */
  --success-color: #10b981;        /* Green - results, success */
  --danger-color: #ef4444;         /* Red - errors, delete */
  --warning-color: #f59e0b;        /* Orange - warnings */
  
  /* Backgrounds */
  --background-color: #f8fafc;     /* Page background */
  --surface-color: #ffffff;        /* Card/panel background */
  
  /* Text */
  --text-color: #1e293b;           /* Main text */
  --text-secondary: #64748b;       /* Secondary text */
  
  /* Borders */
  --border-color: #e2e8f0;         /* Border/divider lines */
}
```

### Common Color Schemes

**Professional Blue (Current)**
```css
--primary-color: #2563eb;
--success-color: #10b981;
```

**Warm Timber Brown**
```css
--primary-color: #92400e;
--success-color: #78350f;
--background-color: #fef3c7;
```

**Modern Dark Theme**
```css
--primary-color: #3b82f6;
--background-color: #1e293b;
--surface-color: #334155;
--text-color: #f1f5f9;
--border-color: #475569;
```

**Nature Green**
```css
--primary-color: #059669;
--success-color: #10b981;
--background-color: #ecfdf5;
```

---

## 📏 Spacing & Sizing

### File: `src/index.css`

```css
:root {
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;      /* Most common */
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  
  /* Border Radius */
  --border-radius-sm: 4px;
  --border-radius: 8px;     /* Most common */
  --border-radius-lg: 12px;
  
  /* Font Sizes */
  --font-size-sm: 0.875rem;    /* 14px */
  --font-size-base: 1rem;       /* 16px */
  --font-size-lg: 1.125rem;     /* 18px */
  --font-size-xl: 1.25rem;      /* 20px */
  --font-size-2xl: 1.5rem;      /* 24px */
  --font-size-3xl: 1.875rem;    /* 30px */
}
```

---

## 🎯 Component-Specific Customization

### Header Styling
**File: `src/styles/Header.css`**

```css
.header {
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  padding: 48px 16px;  /* Adjust height */
}

.header-title {
  font-size: 1.875rem;  /* Change title size */
  font-weight: 700;     /* Make bolder/lighter (400-900) */
}
```

**Quick Changes:**
- Solid color header: Replace `background: linear-gradient...` with `background-color: #2563eb;`
- Smaller header: Change padding to `24px 16px`
- Larger title: Change font-size to `2.5rem`

---

### Button Styling
**File: `src/styles/App.css`**

```css
.btn-primary {
  background-color: var(--primary-color);
  color: white;
  padding: 16px 24px;    /* Size of button */
  border-radius: 8px;    /* Roundness */
  font-weight: 600;      /* Text weight */
}

.btn-primary:hover {
  transform: translateY(-1px);  /* Lift effect */
  box-shadow: var(--shadow-md); /* Shadow on hover */
}
```

**Quick Changes:**
- Rounder buttons: Change border-radius to `24px`
- Bigger buttons: Change padding to `20px 32px`
- No hover animation: Remove or comment out `transform` line
- Flat buttons: Remove `box-shadow` line

---

### Form Input Styling
**File: `src/styles/QuoteForm.css`**

```css
.form-group input,
.form-group select {
  padding: 16px;           /* Inner spacing */
  border: 2px solid #e2e8f0;  /* Border style */
  border-radius: 8px;      /* Roundness */
  font-size: 1rem;         /* Text size */
}
```

**Quick Changes:**
- Larger inputs: Change padding to `20px`
- Thicker borders: Change border to `3px solid...`
- Square inputs: Change border-radius to `0px`

---

### Results Card Styling
**File: `src/styles/Results.css`**

```css
.total-section {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  padding: 32px;
  border-radius: 12px;
}

.total-value {
  font-size: 1.875rem;  /* Size of total price */
  font-weight: 700;     /* Bold level */
}
```

**Quick Changes:**
- Different result color: Change gradient colors
- Larger total: Change font-size to `3rem`
- Add emphasis: Increase padding to `48px`

---

### Board Diagram Styling
**File: `src/styles/Results.css`**

```css
.board {
  background: linear-gradient(180deg, #8b5a3c 0%, #6d4a31 100%);
  height: 60px;        /* Board thickness */
  border-radius: 4px;  /* Board corner radius */
}
```

**Quick Changes:**
- Realistic wood color: Use brown gradient (current)
- Simple boards: Replace with solid color `background-color: #8b5a3c;`
- Thicker boards: Change height to `80px`

---

### Price Editor Table
**File: `src/styles/PriceEditor.css`**

```css
.price-table thead {
  background-color: var(--primary-color);
  color: white;
}

.price-table td {
  padding: 16px;  /* Cell spacing */
}

.price-table tbody tr:hover {
  background-color: #f8fafc;  /* Row hover color */
}
```

---

## 🌈 Quick Style Recipes

### 1. Minimalist Clean
```css
/* In index.css */
:root {
  --primary-color: #000000;
  --success-color: #000000;
  --background-color: #ffffff;
  --border-radius: 0px;
}
```

### 2. Vibrant & Modern
```css
:root {
  --primary-color: #8b5cf6;  /* Purple */
  --success-color: #f59e0b;  /* Orange */
  --background-color: #faf5ff;
  --border-radius: 16px;
}
```

### 3. Corporate Professional
```css
:root {
  --primary-color: #1e40af;  /* Navy blue */
  --success-color: #047857;  /* Forest green */
  --background-color: #f9fafb;
  --border-radius: 4px;
}
```

### 4. Warm & Friendly
```css
:root {
  --primary-color: #ea580c;  /* Orange */
  --success-color: #10b981;  /* Green */
  --background-color: #fff7ed;
  --border-radius: 12px;
}
```

---

## 🔍 Finding Elements to Style

### Use Browser DevTools
1. Right-click on any element
2. Select "Inspect Element"
3. See which CSS class is applied
4. Find that class in the CSS files
5. Make your changes and save

### CSS Class Reference

**Forms:**
- `.quote-form` - Main form container
- `.form-group` - Each input group
- `.form-group input` - Text inputs
- `.form-group select` - Dropdowns

**Results:**
- `.results-container` - Results wrapper
- `.result-item` - Individual result field
- `.total-section` - Total price area
- `.board-diagram` - Visual board layout

**Buttons:**
- `.btn` - All buttons
- `.btn-primary` - Main action buttons
- `.btn-secondary` - Secondary buttons
- `.btn-danger` - Delete/reset buttons

**Layout:**
- `.header` - Top header
- `.main-content` - Main area
- `.container` - Content wrapper
- `.footer` - Bottom footer

---

## 💡 Pro Tips

### 1. Start with Colors
Change CSS variables in `index.css` first - they affect the whole app

### 2. Test as You Go
Save your CSS file and the browser will auto-refresh

### 3. Use Browser DevTools
Experiment with styles in the browser before editing files

### 4. Make Backups
Copy the CSS file before major changes

### 5. One Change at a Time
Easier to identify what works and what doesn't

### 6. Mobile Preview
Test at different screen sizes (browser DevTools > Toggle Device Toolbar)

---

## 📱 Responsive Design

The app is already mobile-friendly! Media queries are included.

**Breakpoints:**
- `@media (max-width: 968px)` - Tablet
- `@media (max-width: 640px)` - Mobile

To adjust mobile styles, find these sections in CSS files.

---

## 🆘 Quick Fixes

### Text is Too Small
```css
/* In index.css */
--font-size-base: 1.125rem;  /* Was 1rem */
```

### Everything is Too Cramped
```css
/* In index.css */
--spacing-md: 24px;  /* Was 16px */
--spacing-lg: 32px;  /* Was 24px */
```

### Buttons Are Too Plain
```css
/* In App.css - add to .btn */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
text-transform: uppercase;
letter-spacing: 0.5px;
```

### Cards Need More Separation
```css
/* In respective component CSS */
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

---

## 🎓 CSS Resources

- **MDN Web Docs**: https://developer.mozilla.org/en-US/docs/Web/CSS
- **CSS Tricks**: https://css-tricks.com/
- **Color Picker**: https://htmlcolorcodes.com/
- **Gradient Generator**: https://cssgradient.io/

---

**Remember**: Save your files and the browser will auto-update! Have fun customizing! 🎨

