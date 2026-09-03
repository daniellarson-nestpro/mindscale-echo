export function briefSavedBody() {
  return { saved: true };
}

export function leadToBriefJson(lead) {
  if (!lead) return { brief: null };
  return {
    brief: {
      companyName: lead.company_name || '',
      website: lead.website || '',
      contactName: lead.contact_name || '',
      contactEmail: lead.email || '',
      phone: lead.phone || '',
      announcementType: lead.announcement_type || '',
      articleUrl: lead.article_url || '',
      articleText: lead.article_text || '',
      quote: lead.quote || '',
      quoteAttribution: lead.quote_attribution || '',
      notes: lead.notes || '',
    },
  };
}
