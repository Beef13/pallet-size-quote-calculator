// The online side of the sync engine, backed by Supabase. Kept thin on purpose: every rule
// about who may see what lives in the database (supabase/migrations), not here.

const PAGE = 1000

function check({ data, error }) {
  if (error) throw new Error(error.message || 'The online copy could not be reached.')
  return data
}

export function createSupabaseRemote(supabase) {
  return {
    async ensureBusiness() {
      return check(await supabase.rpc('ensure_business'))
    },

    async fetchDocuments(businessId) {
      return check(await supabase.from('documents').select('kind, data, updated_at').eq('business_id', businessId)) || []
    },

    async fetchQuotes(businessId) {
      const rows = []
      for (let from = 0; ; from += PAGE) {
        const page = check(await supabase.from('quotes')
          .select('id, data, updated_at, deleted_at')
          .eq('business_id', businessId)
          .order('id')
          .range(from, from + PAGE - 1)) || []
        rows.push(...page)
        if (page.length < PAGE) return rows
      }
    },

    async upsertDocuments(businessId, rows) {
      check(await supabase.from('documents')
        .upsert(rows.map(r => ({ business_id: businessId, ...r })), { onConflict: 'business_id,kind' }))
    },

    async upsertQuotes(businessId, rows) {
      check(await supabase.from('quotes')
        .upsert(rows.map(r => ({ business_id: businessId, ...r })), { onConflict: 'business_id,id' }))
    },

    // Removing the business row removes everything stored under it. The database only
    // lets its owner do this.
    async deleteBusiness(businessId) {
      check(await supabase.from('businesses').delete().eq('id', businessId))
    }
  }
}
