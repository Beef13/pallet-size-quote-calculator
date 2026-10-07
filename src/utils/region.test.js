import { describe, it, expect } from 'vitest'
import { regionFor, guessCountry, initialCountry, gstRateForCountryChange } from './region'

describe('regionFor', () => {
  it('gives each country its GST rate and tax number label', () => {
    expect(regionFor('AU')).toMatchObject({ gstRate: 10, idLabel: 'ABN', idPrint: 'ABN' })
    expect(regionFor('NZ')).toMatchObject({ gstRate: 15, idLabel: 'GST number', idPrint: 'GST No.' })
  })
  it('treats a missing or unknown country as Australia', () => {
    expect(regionFor(undefined).code).toBe('AU')
    expect(regionFor('XX').code).toBe('AU')
  })
})

describe('guessCountry', () => {
  it('picks New Zealand from a New Zealand time zone and Australia otherwise', () => {
    expect(guessCountry('Pacific/Auckland')).toBe('NZ')
    expect(guessCountry('Pacific/Chatham')).toBe('NZ')
    expect(guessCountry('Australia/Melbourne')).toBe('AU')
    expect(guessCountry('')).toBe('AU')
  })
})

describe('initialCountry', () => {
  it('uses the saved country', () => {
    expect(initialCountry({ name: 'Kiwi Pallets', country: 'NZ' }, 'Australia/Sydney')).toBe('NZ')
  })
  it('keeps business details saved before countries existed as Australian, wherever the device is', () => {
    expect(initialCountry({ name: 'Example Pallets', abn: '00 000 000 000' }, 'Pacific/Auckland')).toBe('AU')
  })
  it('guesses from the time zone only when nothing is saved', () => {
    expect(initialCountry(null, 'Pacific/Auckland')).toBe('NZ')
    expect(initialCountry(null, 'Australia/Perth')).toBe('AU')
  })
})

describe('gstRateForCountryChange', () => {
  it('moves a standard rate to the new country\'s rate', () => {
    expect(gstRateForCountryChange(10, 'AU', 'NZ')).toBe(15)
    expect(gstRateForCountryChange(15, 'NZ', 'AU')).toBe(10)
  })
  it('leaves a rate the business set itself', () => {
    expect(gstRateForCountryChange(0, 'AU', 'NZ')).toBe(0)
    expect(gstRateForCountryChange(12.5, 'NZ', 'AU')).toBe(12.5)
  })
})
