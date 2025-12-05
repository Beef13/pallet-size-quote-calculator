import { useState } from 'react'
import Header from './components/Header'
import PalletBuilderOverlay from './components/PalletBuilderOverlay'
import './styles/App.css'

function App() {
  const [quoteData, setQuoteData] = useState(null)

  const handleQuoteCalculated = (data) => {
    setQuoteData(data)
  }

  return (
    <div className="app">
      <PalletBuilderOverlay 
        onQuoteCalculated={handleQuoteCalculated} 
        quoteData={quoteData}
      />
    </div>
  )
}

export default App
