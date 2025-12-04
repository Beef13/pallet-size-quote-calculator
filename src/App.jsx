import { useState } from 'react'
import Header from './components/Header'
import QuoteForm from './components/QuoteForm'
import Results from './components/Results'
import PriceEditor from './components/PriceEditor'
import './styles/App.css'

function App() {
  const [quoteData, setQuoteData] = useState(null)
  const [showPriceEditor, setShowPriceEditor] = useState(false)

  const handleQuoteCalculated = (data) => {
    setQuoteData(data)
  }

  const handlePriceUpdate = () => {
    // Refresh the quote form when prices are updated
    setQuoteData(null)
  }

  return (
    <div className="app">
      <Header />
      
      <main className="main-content">
        <div className="container">
          <div className="toggle-section">
            <button 
              className={`toggle-button ${!showPriceEditor ? 'active' : ''}`}
              onClick={() => setShowPriceEditor(false)}
            >
              Quote Calculator
            </button>
            <button 
              className={`toggle-button ${showPriceEditor ? 'active' : ''}`}
              onClick={() => setShowPriceEditor(true)}
            >
              Price Editor
            </button>
          </div>

          {!showPriceEditor ? (
            <div className="calculator-section">
              <QuoteForm onQuoteCalculated={handleQuoteCalculated} />
              {quoteData && <Results quoteData={quoteData} />}
            </div>
          ) : (
            <PriceEditor onPriceUpdate={handlePriceUpdate} />
          )}
        </div>
      </main>

      <footer className="footer">
        <p>&copy; 2024 Timber Pallet Quote Calculator</p>
      </footer>
    </div>
  )
}

export default App

