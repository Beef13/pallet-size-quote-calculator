import { useState, useEffect } from 'react'
import timberData from '../data/timber-prices.json'
import '../styles/PriceEditor.css'

function PriceEditor({ onPriceUpdate }) {
  const [prices, setPrices] = useState({ timberTypes: [] })
  const [editingCell, setEditingCell] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    // Load prices from localStorage if available, otherwise use default
    const savedPrices = localStorage.getItem('timberPrices')
    if (savedPrices) {
      setPrices(JSON.parse(savedPrices))
    } else {
      setPrices(timberData)
    }
  }, [])

  const handlePriceChange = (typeId, sizeId, newPrice, itemType) => {
    const updatedPrices = { ...prices }
    const typeIndex = updatedPrices.timberTypes.findIndex(t => t.id === typeId)
    
    if (itemType === 'board') {
      const sizeIndex = updatedPrices.timberTypes[typeIndex].boardSizes.findIndex(s => s.id === sizeId)
      updatedPrices.timberTypes[typeIndex].boardSizes[sizeIndex].pricePerBoard = parseFloat(newPrice) || 0
    } else {
      const sizeIndex = updatedPrices.timberTypes[typeIndex].bearerSizes.findIndex(s => s.id === sizeId)
      updatedPrices.timberTypes[typeIndex].bearerSizes[sizeIndex].pricePerBearer = parseFloat(newPrice) || 0
    }
    
    setPrices(updatedPrices)
  }

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('timberPrices', JSON.stringify(prices))
    
    // Show success message
    setSaveMessage('Prices saved successfully!')
    setTimeout(() => setSaveMessage(''), 3000)
    
    // Notify parent component
    if (onPriceUpdate) {
      onPriceUpdate()
    }
  }

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all prices to default values?')) {
      setPrices(timberData)
      localStorage.removeItem('timberPrices')
      setSaveMessage('Prices reset to default!')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(prices, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'timber-prices-backup.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="price-editor-container">
      <div className="price-editor-header">
        <h2>Price Editor</h2>
        <p className="editor-description">
          Update timber prices below. Changes are saved to your browser's local storage.
        </p>
      </div>

      {saveMessage && (
        <div className="save-message success">
          {saveMessage}
        </div>
      )}

      <div className="price-table-section">
        <h3 className="timber-type-heading">Hardware & Fasteners</h3>
        <table className="price-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit</th>
              <th>Price per Unit ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nails</td>
              <td>Per Nail</td>
              <td>
                <input
                  type="number"
                  className="price-input"
                  value={prices.nailPricePerNail || 0.02}
                  onChange={(e) => {
                    const updatedPrices = { ...prices }
                    updatedPrices.nailPricePerNail = parseFloat(e.target.value) || 0
                    setPrices(updatedPrices)
                  }}
                  min="0"
                  step="0.01"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="price-tables">
        {prices.timberTypes.map(timberType => (
          <div key={timberType.id} className="price-table-section">
            <h3 className="timber-type-heading">{timberType.name}</h3>
            
            <div className="table-group">
              <h4 className="table-subheading">Top Boards (Decking)</h4>
              <table className="price-table">
                <thead>
                  <tr>
                    <th>Size</th>
                    <th>Width (mm)</th>
                    <th>Thickness (mm)</th>
                    <th>Price per Board ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {timberType.boardSizes.map(size => (
                    <tr key={size.id}>
                      <td>{size.dimensions}</td>
                      <td>{size.width}</td>
                      <td>{size.thickness}</td>
                      <td>
                        <input
                          type="number"
                          className="price-input"
                          value={size.pricePerBoard}
                          onChange={(e) => handlePriceChange(timberType.id, size.id, e.target.value, 'board')}
                          onFocus={() => setEditingCell(`${timberType.id}-board-${size.id}`)}
                          onBlur={() => setEditingCell(null)}
                          min="0"
                          step="0.01"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-group">
              <h4 className="table-subheading">Bearers (Stringers)</h4>
              <table className="price-table">
                <thead>
                  <tr>
                    <th>Size</th>
                    <th>Width (mm)</th>
                    <th>Thickness (mm)</th>
                    <th>Price per Bearer ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {timberType.bearerSizes.map(size => (
                    <tr key={size.id}>
                      <td>{size.dimensions}</td>
                      <td>{size.width}</td>
                      <td>{size.thickness}</td>
                      <td>
                        <input
                          type="number"
                          className="price-input"
                          value={size.pricePerBearer}
                          onChange={(e) => handlePriceChange(timberType.id, size.id, e.target.value, 'bearer')}
                          onFocus={() => setEditingCell(`${timberType.id}-bearer-${size.id}`)}
                          onBlur={() => setEditingCell(null)}
                          min="0"
                          step="0.01"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="editor-actions">
        <button onClick={handleSave} className="btn btn-primary">
          Save Changes
        </button>
        <button onClick={handleExport} className="btn btn-secondary">
          Export Prices
        </button>
        <button onClick={handleReset} className="btn btn-danger">
          Reset to Default
        </button>
      </div>

      <div className="editor-info">
        <h4>Instructions:</h4>
        <ul>
          <li>Click on any price field to edit</li>
          <li>Click "Save Changes" to store your updates</li>
          <li>Use "Export Prices" to download a backup</li>
          <li>Use "Reset to Default" to restore original prices</li>
        </ul>
      </div>
    </div>
  )
}

export default PriceEditor

