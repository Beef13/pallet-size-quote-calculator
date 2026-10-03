// Who runs Pallet Quote. Shown on the Terms of use and Privacy pages.
// Fill these in before the legal pages go live: anything left blank shows as "[to be confirmed]".
export const operator = {
  name: 'Saverio Curcio',     // legal name of the business or person, e.g. "Example Pallets Pty Ltd"
  abn: '53 795 324 705',      // e.g. "12 345 678 901" (leave blank if none)
  email: 'contact@palletquoter.com',    // contact address for questions and privacy requests
  state: 'Victoria'     // Australian state or territory whose law applies, e.g. "Victoria"
}

// Follows the build: when accounts are switched on (VITE_SUPABASE_URL is set), the Terms and
// Privacy pages show the wording about accounts and online storage in place of the "nothing
// leaves your device" wording. `dataRegion` is where the database is.
export const accounts = {
  enabled: Boolean(import.meta.env.VITE_SUPABASE_URL),
  dataRegion: 'Sydney, Australia'
}

// Shown at the top of both pages. Change it whenever the wording changes.
export const lastUpdated = '3 October 2026'
