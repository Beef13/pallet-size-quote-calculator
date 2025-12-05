# Timber Pallet Quote Calculator

A web-based quote calculator for timber pallet businesses. Calculate pricing based on timber type, size, and quantity, while automatically computing board gap spacing.

## Features

- **Quote Calculation**: Calculate total cost based on timber type, size, and quantity
- **Gap Calculation**: Automatically compute spacing between boards for even distribution
- **Price Management**: Easy-to-use interface for updating timber prices
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **No Database Required**: Uses JSON file for price storage (easy to edit)

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open your browser to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

## Usage

1. **Generate a Quote**:
   - Select timber type from dropdown
   - Choose board size for top decking
   - Enter number of boards needed
   - Choose bearer size for stringers
   - Enter number of bearers needed
   - Enter pallet width (in mm)
   - Click "Calculate Quote"

2. **View Results**:
   - Total quote price (boards + bearers)
   - Gap size between boards
   - Itemized breakdown showing boards and bearers separately

3. **Manage Prices** (Admin):
   - Navigate to Price Editor
   - Update board and bearer prices inline
   - Separate pricing for boards and bearers
   - Add new timber types/sizes
   - Save changes

## Project Structure

```
src/
├── components/         # React components
├── data/              # Timber price data (JSON)
├── utils/             # Calculation logic
└── styles/            # CSS styling files
```

## Customization

### Editing Styles
All styling is in plain CSS files located in `src/styles/`. Edit these files to customize the appearance.

### Updating Prices
Edit `src/data/timber-prices.json` directly or use the Price Editor interface.

## Future Enhancements

- Save quote history
- Export quotes to PDF
- Customer management
- AI agent integration
- Email functionality

## License

Private - For internal business use

## Support

See `IMPLEMENTATION_GUIDE.md` for detailed documentation.


