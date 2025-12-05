import { useState, useEffect } from 'react'
import timberData from '../data/timber-prices.json'
import LockIcon from './LockIcon'
import '../styles/PriceEditor.css'

function PriceEditor({ onPriceUpdate }) {
  const [prices, setPrices] = useState({ timberTypes: [] })
  const [editingCell, setEditingCell] = useState(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [lockedFields, setLockedFields] = useState(new Set())
  const [allLocked, setAllLocked] = useState(true)

  useEffect(() => {
    // Load prices from localStorage if available, otherwise use default
    const savedPrices = localStorage.getItem('timberPrices')
    if (savedPrices) {
      setPrices(JSON.parse(savedPrices))
    } else {
      setPrices(timberData)
    }
    
    // Load lock state
    const savedLockState = localStorage.getItem('priceLockedFields')
    if (savedLockState) {
      setLockedFields(new Set(JSON.parse(savedLockState)))
    } else {
      // Lock all fields by default
      const allFieldIds = []
      timberData.timberTypes.forEach(type => {
        type.boardSizes.forEach(size => allFieldIds.push(`${type.id}-board-${size.id}`))
        type.bearerSizes.forEach(size => allFieldIds.push(`${type.id}-bearer-${size.id}`))
      })
      allFieldIds.push('nails')
      setLockedFields(new Set(allFieldIds))
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

  const toggleLock = (fieldId) => {
    const newLockedFields = new Set(lockedFields)
    if (newLockedFields.has(fieldId)) {
      newLockedFields.delete(fieldId)
    } else {
      newLockedFields.add(fieldId)
    }
    setLockedFields(newLockedFields)
    localStorage.setItem('priceLockedFields', JSON.stringify([...newLockedFields]))
  }

  const toggleAllLocks = () => {
    if (allLocked) {
      // Unlock all
      setLockedFields(new Set())
      localStorage.setItem('priceLockedFields', JSON.stringify([]))
      setAllLocked(false)
    } else {
      // Lock all
      const allFieldIds = []
      prices.timberTypes.forEach(type => {
        type.boardSizes.forEach(size => allFieldIds.push(`${type.id}-board-${size.id}`))
        type.bearerSizes.forEach(size => allFieldIds.push(`${type.id}-bearer-${size.id}`))
      })
      allFieldIds.push('nails')
      setLockedFields(new Set(allFieldIds))
      localStorage.setItem('priceLockedFields', JSON.stringify(allFieldIds))
      setAllLocked(true)
    }
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
              <th>Lock</th>
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
                  disabled={lockedFields.has('nails')}
                  min="0"
                  step="0.01"
                />
              </td>
              <td>
                <LockIcon 
                  isLocked={lockedFields.has('nails')} 
                  onClick={() => toggleLock('nails')}
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
                    <th>Lock</th>
                  </tr>
                </thead>
                <tbody>
                  {timberType.boardSizes.map(size => {
                    const fieldId = `${timberType.id}-board-${size.id}`
                    const isLocked = lockedFields.has(fieldId)
                    return (
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
                            onFocus={() => setEditingCell(fieldId)}
                            onBlur={() => setEditingCell(null)}
                            disabled={isLocked}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td>
                          <LockIcon 
                            isLocked={isLocked} 
                            onClick={() => toggleLock(fieldId)}
                          />
                        </td>
                      </tr>
                    )
                  })}
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
                    <th>Lock</th>
                  </tr>
                </thead>
                <tbody>
                  {timberType.bearerSizes.map(size => {
                    const fieldId = `${timberType.id}-bearer-${size.id}`
                    const isLocked = lockedFields.has(fieldId)
                    return (
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
                            onFocus={() => setEditingCell(fieldId)}
                            onBlur={() => setEditingCell(null)}
                            disabled={isLocked}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td>
                          <LockIcon 
                            isLocked={isLocked} 
                            onClick={() => toggleLock(fieldId)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="editor-actions">
        <button onClick={toggleAllLocks} className="btn btn-secondary">
          {allLocked ? '🔓 Unlock All Prices' : '🔒 Lock All Prices'}
        </button>
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
          <li>🔒 <strong>Lock/Unlock:</strong> Click the lock icon next to each price to enable editing</li>
          <li>🔓 <strong>Unlock All:</strong> Use the "Unlock All Prices" button to edit multiple fields</li>
          <li>✏️ <strong>Edit:</strong> Click unlocked price fields to change values</li>
          <li>💾 <strong>Save:</strong> Click "Save Changes" to store your updates</li>
          <li>📥 <strong>Export:</strong> Download a backup of all prices</li>
          <li>🔄 <strong>Reset:</strong> Restore original default prices</li>
        </ul>
      </div>
    </div>
  )
}

export default PriceEditor

