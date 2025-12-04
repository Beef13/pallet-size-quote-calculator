# Quick Start Guide

## 🎉 Project Setup Complete!

Your Timber Pallet Quote Calculator is now fully set up and ready to use.

---

## 📁 What Was Created

### Core Files
- ✅ React + Vite project structure
- ✅ All dependencies installed
- ✅ Complete component system
- ✅ CSS styling files (easy to customize!)
- ✅ Calculation utilities
- ✅ Sample timber price data

### File Structure
```
quote-calculator/
├── src/
│   ├── components/          # 4 React components
│   │   ├── Header.jsx       # App header
│   │   ├── QuoteForm.jsx    # Main calculator form
│   │   ├── Results.jsx      # Results display
│   │   └── PriceEditor.jsx  # Price management
│   ├── styles/              # 5 CSS files (customize these!)
│   │   ├── App.css
│   │   ├── Header.css
│   │   ├── QuoteForm.css
│   │   ├── Results.css
│   │   └── PriceEditor.css
│   ├── data/
│   │   └── timber-prices.json  # Price database
│   ├── utils/
│   │   └── calculations.js     # Business logic
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles & CSS variables
├── IMPLEMENTATION_GUIDE.md  # Detailed documentation
└── README.md                # Project overview
```

---

## 🚀 Getting Started

### Start the Development Server
```bash
cd "/Users/savcurcio/Documents/Developer/VPS-AGENTS/Qoute Calculator"
npm run dev
```

The app will open at `http://localhost:5173`

### What You'll See
1. **Quote Calculator Tab** (default view)
   - Select timber type (Pine, Oak, Hardwood, Treated Pine)
   - Choose **board size** for top decking
   - Enter number of boards
   - Choose **bearer size** for stringers/support
   - Enter number of bearers
   - Enter pallet width
   - Calculate quote with gap spacing

2. **Price Editor Tab**
   - View all timber types with both board and bearer sizes
   - Edit prices inline for boards and bearers separately
   - Save changes to browser storage
   - Export/reset functionality

---

## 🎨 Customizing the Design

### Where to Edit Styles

All CSS files are in `src/styles/`. Here's what each file controls:

1. **`index.css`** - CSS variables (colors, spacing, fonts)
   ```css
   :root {
     --primary-color: #2563eb;  /* Main blue color */
     --success-color: #10b981;  /* Green for results */
     /* etc... */
   }
   ```

2. **`App.css`** - Layout, buttons, main structure
3. **`Header.css`** - Top header styling
4. **`QuoteForm.css`** - Form inputs and layout
5. **`Results.css`** - Results display and board diagram
6. **`PriceEditor.css`** - Price editor tables and inputs

### Quick Color Changes

Edit `src/index.css` and change these variables:

```css
:root {
  --primary-color: #your-color;      /* Main brand color */
  --success-color: #your-color;      /* Results/success */
  --background-color: #your-color;   /* Page background */
  --text-color: #your-color;         /* Main text */
}
```

Save the file and the app will update immediately!

---

## 💡 Key Features

### Quote Calculator
- ✅ Dynamic timber type selection
- ✅ Separate board and bearer size selectors
- ✅ Size dropdowns filtered by type
- ✅ Real-time validation
- ✅ Gap calculation with visual preview
- ✅ Professional results display with itemized breakdown

### Gap Calculation Logic
```
Gap Size = (Pallet Width - Total Board Width) / (Number of Boards - 1)
```
- Boards are flush with pallet edges
- Even spacing between boards only
- Validates minimum gap size (5mm)

### Price Management
- ✅ Edit prices without touching code
- ✅ Saved to browser's localStorage
- ✅ Export prices as backup JSON
- ✅ Reset to defaults anytime

---

## 📊 Sample Data Included

The app comes with sample prices for:
- **Pine**: 3 board sizes + 3 bearer sizes
- **Treated Pine**: 3 board sizes + 3 bearer sizes
- **Hardwood**: 3 board sizes + 3 bearer sizes
- **Oak**: 3 board sizes + 3 bearer sizes

Each timber type has separate pricing for:
- **Boards** (top decking): Thinner pieces (22-30mm thick)
- **Bearers** (stringers): Thicker support pieces (38-75mm thick)

Edit these in the Price Editor tab or directly in `src/data/timber-prices.json`

---

## 🔧 Common Tasks

### Add a New Timber Type
Edit `src/data/timber-prices.json`:
```json
{
  "id": "cedar",
  "name": "Cedar",
  "sizes": [
    {
      "id": "100x25",
      "dimensions": "100x25mm",
      "width": 100,
      "thickness": 25,
      "pricePerBoard": 5.50
    }
  ]
}
```

### Change Button Colors
Edit `src/styles/App.css`:
```css
.btn-primary {
  background-color: #your-color;
}
```

### Modify Heading
Edit `src/components/Header.jsx`:
```jsx
<h1 className="header-title">Your Custom Title</h1>
```

---

## 🏗️ Build for Production

When ready to deploy:

```bash
npm run build
```

This creates a `dist` folder with optimized files ready for hosting.

---

## 📖 Next Steps

1. **Test the calculator** - Try different timber types and quantities
2. **Customize the styling** - Edit CSS to match your brand
3. **Update timber prices** - Use the Price Editor or edit JSON
4. **Review the detailed guide** - See `IMPLEMENTATION_GUIDE.md`

---

## 🆘 Need Help?

### Styling Issues
- Check browser console (F12) for errors
- Verify CSS file paths are correct
- Make sure you saved the files

### Calculator Not Working
- Check that `timber-prices.json` is valid JSON
- Verify all components are imported correctly
- Look at browser console for errors

### Development Server Won't Start
- Make sure you're in the correct directory
- Run `npm install` again if needed
- Check that port 5173 isn't already in use

---

## 🎯 Future Enhancements

Consider adding:
- PDF export for quotes
- Email functionality
- Quote history
- Customer database
- Multiple currencies
- AI agent for automated quoting

See `IMPLEMENTATION_GUIDE.md` for detailed enhancement ideas.

---

**Happy Calculating!** 🎉

Your quote calculator is ready to streamline your parents' timber pallet business workflow.

