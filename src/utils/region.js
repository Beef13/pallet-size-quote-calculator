// The country a business quotes in. It decides the GST rate a new price list starts with and
// what the business's tax number is called on the Prices tab and the customer PDF.
// The number itself is still stored as `business.abn`, so nothing saved needs converting.

export const REGIONS = {
  AU: { code: 'AU', name: 'Australia', gstRate: 10, idLabel: 'ABN', idPrint: 'ABN', idPlaceholder: '12 345 678 901' },
  NZ: { code: 'NZ', name: 'New Zealand', gstRate: 15, idLabel: 'GST number', idPrint: 'GST No.', idPlaceholder: '123-456-789' }
}

export const DEFAULT_COUNTRY = 'AU'

/** The settings for a country code; anything unknown or missing is treated as Australia. */
export function regionFor(code) {
  return REGIONS[code] || REGIONS[DEFAULT_COUNTRY]
}

/** A first guess for a device that has nothing saved yet, from its time zone. */
export function guessCountry(timeZone) {
  return timeZone === 'Pacific/Auckland' || timeZone === 'Pacific/Chatham' ? 'NZ' : DEFAULT_COUNTRY
}

/** The time zone this device reports, or '' where it can't be read. */
export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch (e) {
    return ''
  }
}

/**
 * The country to start with, from what is saved on the device (the parsed `palletBusiness`).
 * A saved country wins. Business details saved before countries existed are Australian.
 * Only a device with no business details yet is guessed from its time zone.
 */
export function initialCountry(savedBusiness, timeZone) {
  if (savedBusiness && typeof savedBusiness === 'object') {
    return REGIONS[savedBusiness.country] ? savedBusiness.country : DEFAULT_COUNTRY
  }
  return guessCountry(timeZone)
}

/**
 * The GST rate after the country changes. The rate follows the country only if it was still
 * the old country's standard rate; a rate the business set itself is left alone.
 */
export function gstRateForCountryChange(currentRate, fromCode, toCode) {
  const current = Number(currentRate)
  if (current === regionFor(fromCode).gstRate) return regionFor(toCode).gstRate
  return Number.isFinite(current) ? current : regionFor(toCode).gstRate
}
