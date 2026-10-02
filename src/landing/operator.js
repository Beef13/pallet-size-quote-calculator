// Who runs Pallet Quote. Shown on the Terms of use and Privacy pages.
// Fill these in before the legal pages go live: anything left blank shows as "[to be confirmed]".
export const operator = {
  name: '',     // legal name of the business or person, e.g. "Example Pallets Pty Ltd"
  abn: '',      // e.g. "12 345 678 901" (leave blank if none)
  email: '',    // contact address for questions and privacy requests
  state: ''     // Australian state or territory whose law applies, e.g. "Victoria"
}

// Set to true in the same release that switches accounts on (VITE_SUPABASE_URL is set).
// The Terms and Privacy pages then show the wording about accounts and online storage in
// place of the "nothing leaves your device" wording. `dataRegion` is where the database is.
export const accounts = {
  enabled: false,
  dataRegion: 'Sydney, Australia'
}

// Shown at the top of both pages. Change it whenever the wording changes.
export const lastUpdated = '2 October 2026'
