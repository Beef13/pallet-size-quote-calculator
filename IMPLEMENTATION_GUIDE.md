# Timber Pallet Quote Calculator - Implementation Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Implementation Stages](#implementation-stages)
5. [Component Details](#component-details)
6. [Calculation Logic](#calculation-logic)
7. [Styling Guide](#styling-guide)
8. [Testing & Deployment](#testing--deployment)

---

## Project Overview

A web-based quote calculator for a timber pallet business that:
- Calculates pricing based on timber type, size, and number of boards
- Computes gap spacing between boards for even distribution
- Allows easy price management without code changes
- Provides a clean, professional interface

---

## Technology Stack

- **Frontend Framework**: React 18+
- **Build Tool**: Vite (fast development, hot reload)
- **Styling**: Plain CSS (easy to customize)
- **Data Format**: JSON (for timber prices)
- **JavaScript**: ES6+ features

---

## Project Structure

```
quote-calculator/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── QuoteForm.jsx           # Main calculator form
│   │   ├── Results.jsx             # Display quote results
│   │   ├── PriceEditor.jsx         # Admin interface for prices
│   │   └── Header.jsx              # Application header
│   ├── data/
│   │   └── timber-prices.json      # Editable price database
│   ├── utils/
│   │   └── calculations.js         # Business logic functions
│   ├── styles/
│   │   ├── App.css                 # Main application styles
│   │   ├── QuoteForm.css          # Quote form styles
│   │   ├── Results.css            # Results display styles
│   │   ├── PriceEditor.css        # Price editor styles
│   │   └── Header.css             # Header styles
│   ├── App.jsx                     # Root component
│   ├── main.jsx                    # Application entry point
│   └── index.css                   # Global styles
├── package.json
├── vite.config.js
├── index.html
└── README.md
```

---

## Implementation Stages

### Stage 1: Project Setup ✓
**Goal**: Initialize the project with correct dependencies

**Steps**:
1. Create React + Vite project: `npm create vite@latest quote-calculator -- --template react`
2. Install dependencies: `npm install`
3. Clean up default files
4. Create folder structure (components, data, utils, styles)

**Files to Create**:
- Project folders: `/src/components`, `/src/data`, `/src/utils`, `/src/styles`

---

### Stage 2: Data Structure Setup
**Goal**: Define timber types, sizes, and prices

**Steps**:
1. Create `timber-prices.json` with initial data structure
2. Define timber types (e.g., Pine, Oak, Hardwood, Treated Pine)
3. Define sizes for each type (e.g., 100x22mm, 120x25mm, 150x30mm)
4. Set initial prices per board

**Example Data Structure**:
```json
{
  "timberTypes": [
    {
      "id": "pine",
      "name": "Pine",
      "boardSizes": [
        {
          "id": "100x22",
          "dimensions": "100x22mm",
          "width": 100,
          "thickness": 22,
          "pricePerBoard": 2.50
        }
      ],
      "bearerSizes": [
        {
          "id": "75x38",
          "dimensions": "75x38mm",
          "width": 75,
          "thickness": 38,
          "pricePerBearer": 4.50
        }
      ]
    }
  ]
}
```

---

### Stage 3: Calculation Logic
**Goal**: Implement core business logic

**Steps**:
1. Create `calculations.js` utility file
2. Implement gap calculation function
3. Implement price calculation function
4. Add input validation functions

**Gap Calculation Formula**:
```
Total board width = Number of boards × Board width (mm)
Available space = Pallet width - Total board width
Number of gaps = Number of boards + 1
Gap size = Available space ÷ Number of gaps
```

**Functions to Implement**:
- `calculateGapSize(palletWidth, boardWidth, numberOfBoards)`
- `calculateTotalPrice(pricePerBoard, numberOfBoards)`
- `validateInputs(palletWidth, numberOfBoards)`

---

### Stage 4: Quote Form Component
**Goal**: Build main user interface for quote generation

**Steps**:
1. Create `QuoteForm.jsx` component
2. Add state management for form inputs
3. Create dropdown for timber type selection
4. Create dropdown for board size selection (filtered by type)
5. Add number input for board quantity
6. Create dropdown for bearer size selection (filtered by type)
7. Add number input for bearer quantity
8. Add number input for pallet width
9. Add "Calculate Quote" button
10. Connect to calculation functions

**State Variables**:
- `selectedType` - Currently selected timber type
- `selectedBoardSize` - Currently selected board size
- `selectedBearerSize` - Currently selected bearer size
- `numberOfBoards` - Number of boards input
- `numberOfBearers` - Number of bearers input
- `palletWidth` - Pallet width input (mm)
- `quoteResult` - Calculated quote data

---

### Stage 5: Results Component
**Goal**: Display calculated quote information

**Steps**:
1. Create `Results.jsx` component
2. Display selected timber details (type, size)
3. Show quantity and unit price
4. Display total price (prominently)
5. Show calculated gap size
6. Add visual board spacing diagram (optional)

**Display Elements**:
- Timber Type: [Selected type]
- **Top Boards Section:**
  - Board Size: [Selected size]
  - Quantity: [Number of boards]
  - Unit Price: $[price per board]
  - Subtotal: $[boards total]
- **Bearers Section:**
  - Bearer Size: [Selected size]
  - Quantity: [Number of bearers]
  - Unit Price: $[price per bearer]
  - Subtotal: $[bearers total]
- **Spacing:**
  - Pallet Width: [width] mm
  - Gap Between Boards: [gap size] mm
- **Total Price: $[total]**

---

### Stage 6: Price Editor Component
**Goal**: Admin interface for price management

**Steps**:
1. Create `PriceEditor.jsx` component
2. Display all timber types and sizes in a table
3. Add inline editing for prices
4. Implement save functionality (localStorage or JSON update)
5. Add "Add New Type" and "Add New Size" features
6. Include delete functionality

**Features**:
- Editable price fields
- Real-time updates
- Confirmation before deletion
- Export/Import price data

---

### Stage 7: Styling and Polish
**Goal**: Professional, clean interface with easy-to-edit CSS

**Steps**:
1. Create global styles in `index.css`
2. Style each component with dedicated CSS files
3. Implement responsive design (mobile-friendly)
4. Add color scheme and branding
5. Improve form accessibility
6. Add loading states and animations

**CSS Variables** (for easy customization):
```css
:root {
  --primary-color: #2563eb;
  --secondary-color: #64748b;
  --success-color: #10b981;
  --background-color: #f8fafc;
  --text-color: #1e293b;
  --border-color: #e2e8f0;
  --border-radius: 8px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}
```

---

## Component Details

### QuoteForm.jsx
**Purpose**: Main calculator interface

**Props**: 
- `onQuoteCalculated` - Callback function with quote result

**Key Features**:
- Controlled form inputs
- Dynamic size dropdown (filtered by selected type)
- Input validation
- Clear form button

---

### Results.jsx
**Purpose**: Display quote calculation results

**Props**:
- `quoteData` - Object containing calculation results

**Display Data**:
```javascript
{
  timberType: "Pine",
  boardSize: "100x22mm",
  bearerSize: "75x38mm",
  numberOfBoards: 10,
  numberOfBearers: 3,
  pricePerBoard: 2.50,
  pricePerBearer: 4.50,
  boardsTotal: 25.00,
  bearersTotal: 13.50,
  totalPrice: 38.50,
  palletWidth: 1200,
  boardWidth: 100,
  gapSize: 10.91
}
```

---

### PriceEditor.jsx
**Purpose**: Admin interface for price management

**Key Features**:
- Load prices from JSON
- Inline editing
- Save changes
- Add/remove types and sizes
- Password protection (optional)

---

## Calculation Logic

### Gap Size Calculation
```javascript
function calculateGapSize(palletWidth, boardWidth, numberOfBoards) {
  const totalBoardWidth = boardWidth * numberOfBoards;
  const availableSpace = palletWidth - totalBoardWidth;
  const numberOfGaps = numberOfBoards - 1; // Boards flush with edges
  
  if (numberOfGaps <= 0) return 0; // Single board case
  
  const gapSize = availableSpace / numberOfGaps;
  
  return Math.round(gapSize * 100) / 100; // Round to 2 decimals
}
```

Note: The outer boards are flush with the pallet edges.

### Total Price Calculation
```javascript
function calculateTotalPrice(pricePerBoard, numberOfBoards) {
  return (pricePerBoard * numberOfBoards).toFixed(2);
}
```

### Input Validation
```javascript
function validateInputs(palletWidth, boardWidth, numberOfBoards) {
  const totalBoardWidth = boardWidth * numberOfBoards;
  
  if (totalBoardWidth >= palletWidth) {
    return {
      valid: false,
      error: "Boards are too wide for the pallet. Reduce quantity or increase pallet width."
    };
  }
  
  return { valid: true };
}
```

---

## Styling Guide

### Design Principles
1. **Clean and Minimal**: Avoid clutter, focus on functionality
2. **Professional**: Suitable for business use
3. **Readable**: Clear labels, adequate spacing, good contrast
4. **Responsive**: Works on desktop, tablet, and mobile
5. **Accessible**: Proper form labels, keyboard navigation

### Color Scheme Suggestions
- **Primary (Brand)**: Blue (#2563eb) - buttons, highlights
- **Success**: Green (#10b981) - results, confirmations
- **Background**: Light gray (#f8fafc) - page background
- **Text**: Dark slate (#1e293b) - main text
- **Borders**: Light gray (#e2e8f0) - dividers, inputs

### Typography
- **Headings**: Sans-serif, bold, larger size
- **Body Text**: Sans-serif, regular weight
- **Numbers/Results**: Larger, bold for emphasis

### Layout
- **Form**: Centered, max-width 600px
- **Results**: Card-style, prominent total
- **Price Editor**: Table layout, full width

---

## Testing & Deployment

### Testing Checklist
- [ ] Calculate quote with different timber types
- [ ] Calculate quote with different board quantities
- [ ] Verify gap calculation is accurate
- [ ] Test with edge cases (very few/many boards)
- [ ] Verify price editor saves changes
- [ ] Test responsive design on mobile
- [ ] Check accessibility (keyboard navigation)

### Deployment Options

**Option 1: Vercel (Recommended)**
1. Push code to GitHub
2. Import project to Vercel
3. Deploy automatically

**Option 2: Netlify**
1. Connect GitHub repository
2. Configure build command: `npm run build`
3. Deploy

**Option 3: Local Network**
1. Build project: `npm run build`
2. Host `dist` folder on local server
3. Access via local IP address

---

## Future Enhancements

### Phase 2 Features
- Save quote history
- Export quotes to PDF
- Customer database integration
- Email quotes to customers
- Multiple currency support

### Phase 3 Features (AI Agent)
- Automated quote generation from customer messages
- Inventory tracking
- Order management system
- Analytics and reporting
- Voice input for quotes

---

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Install new dependency
npm install [package-name]
```

---

## Troubleshooting

### Common Issues

**Issue**: Gap calculation shows negative number
- **Solution**: Boards are too wide for pallet. Add validation to prevent this.

**Issue**: Prices don't update after editing
- **Solution**: Check that state is updating and component is re-rendering.

**Issue**: Dropdown not showing sizes
- **Solution**: Verify timber type is selected and sizes array exists in data.

---

## Support

For questions or issues:
1. Check this implementation guide
2. Review component code comments
3. Test calculation logic in browser console
4. Verify data structure in JSON file

---

**Last Updated**: December 2025
**Version**: 1.0.0

