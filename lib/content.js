/** All marketing copy lives here so it can be edited without touching layout. */

export const BRAND = {
  name: 'Mindscale Echo',
  parent: 'Mindscale Partners',
  subheadline: 'AI-powered media distribution for the human and AI layers.',
  heroCopy:
    'You already earned the story. Mindscale Echo turns your local coverage into a professionally written press release, distributes it across major media channels, and helps your brand become discoverable in search engines and AI answer engines.',
  hook: 'Send us your local article. We’ll turn it into a press release and distribute it.',
  primaryCta: 'Launch Your Release',
  secondaryCta: 'See How It Works',
};

export const HERO_PROOF = [
  'AI-written press release',
  '300+ to 500+ outlets by package',
  'Search-indexed publisher placements',
  'AI visibility support on Premium',
  '“As seen in” badges + placement dashboard',
];

/* ---------- Two-layer distribution diagram ---------- */

export const DIAGRAM = {
  input: {
    label: 'Input',
    title: 'Local Article or Business Announcement',
    detail:
      'A local write-up, opening, expansion, executive hire, funding note, award, or community feature.',
  },
  core: {
    label: 'Engine',
    title: 'Mindscale Echo',
    detail: 'AI-assisted drafting, editorial formatting, structured distribution.',
  },
  layers: [
    {
      id: 'human',
      label: 'Path 01',
      title: 'Human Media Layer',
      accent: 'mint',
      note: 'Distribution network includes',
      destinations: [
        'PRS Wire',
        'Yahoo Finance',
        'CNBC',
        'Business Insider',
        'Associated Press',
        'Google News',
        'Finance and news publishers',
        '300+ / 500+ media outlets',
      ],
    },
    {
      id: 'ai',
      label: 'Path 02',
      title: 'AI Discovery Layer',
      accent: 'violet',
      note: 'Premium package — eligible discovery surfaces',
      destinations: [
        'ChatGPT / OpenAI',
        'Perplexity',
        'Grok',
        'Google Gemini',
        'Microsoft Copilot',
        'AI search and answer engines',
      ],
    },
  ],
  outputs: [
    { title: 'SEO lift', detail: 'Indexed publisher pages pointing at your brand.' },
    { title: 'Human brand awareness', detail: 'Recognisable placements buyers already trust.' },
    { title: 'AI visibility', detail: 'Structured signals for answer engines to draw on.' },
    { title: 'Demand generation', detail: 'A credible asset for sales and follow-up.' },
    { title: 'A more discoverable brand narrative', detail: 'One story, many surfaces.' },
  ],
};

/* ---------- As seen in ---------- */

export const MEDIA_BADGES = [
  'Business Insider',
  'Yahoo! Finance',
  'ChatGPT',
  'Associated Press',
  'Bloomberg',
  'Reuters',
  'Dow Jones Factiva',
  'Apple News',
  'Google News',
  'Benzinga',
  'Fox 40',
  'Substack',
];

export const AI_BADGES = ['Perplexity', 'Google Gemini', 'Grok AI', 'Microsoft Copilot'];

/* ---------- How it works ---------- */

export const STEPS = [
  {
    n: '01',
    title: 'Paste Your Article',
    copy: 'Customer submits a local news article, company announcement, or business milestone.',
  },
  {
    n: '02',
    title: 'We Write the Release',
    copy: 'Mindscale Echo drafts a professional press release using AI-assisted writing and human-ready formatting.',
  },
  {
    n: '03',
    title: 'Approve and Checkout',
    copy: 'Customer selects Basic or Premium, approves the release, and checks out securely.',
  },
  {
    n: '04',
    title: 'Distribution and Dashboard',
    copy: 'The release is distributed, and the customer gets a dashboard with placements, links, badges, and reports.',
  },
];

/* ---------- Dashboard preview ---------- */

export const DASHBOARD_ITEMS = [
  {
    title: 'Press release status',
    detail: 'Draft, approval, scheduled, live — tracked end to end.',
    tag: 'All packages',
  },
  {
    title: 'Live placement links',
    detail: 'Direct URLs to every reported placement as they land.',
    tag: 'All packages',
  },
  {
    title: 'Featured outlet list',
    detail: 'The publishers your release was carried on, exportable.',
    tag: 'All packages',
  },
  {
    title: '“As seen in” badge kit',
    detail: 'Web, deck, and social-ready badge assets with usage notes.',
    tag: 'All packages',
  },
  {
    title: 'AI visibility report',
    detail: 'How your narrative is surfacing across AI answer engines.',
    tag: 'Premium',
  },
  {
    title: 'Podcast placement links',
    detail: 'Audio syndication reporting across podcast platforms.',
    tag: 'Premium',
  },
  {
    title: 'Follow-up pitching recommendations',
    detail: 'Where this asset is strongest for a second wave of coverage.',
    tag: 'All packages',
  },
];

/* ---------- FAQ ---------- */

export const FAQ = [
  {
    q: 'What is Mindscale Echo?',
    a: 'Mindscale Echo turns existing local coverage or business milestones into a professionally written press release, distributes it through media channels, and helps improve visibility across search and AI discovery systems.',
  },
  {
    q: 'Who is this for?',
    a: 'Small businesses, funded startups, and privately owned companies that have newsworthy momentum, including openings, expansions, leadership hires, funding, awards, partnerships, or local media coverage.',
  },
  {
    q: 'Do I need to already have a news article?',
    a: 'A recent article is ideal, but you can also submit a business announcement, milestone, or company update.',
  },
  {
    q: 'What is included in Basic?',
    a: 'Basic includes AI-assisted press release writing, standard distribution, 300+ media outlet distribution, search-indexed placements, “as seen in” badge assets, a placement dashboard, and basic reporting.',
  },
  {
    q: 'What is included in Premium?',
    a: 'Premium includes everything in Basic plus 500+ outlet distribution, AI discovery layer support, AI visibility reporting, podcast/audio distribution, and an enhanced dashboard.',
  },
  {
    q: 'Which AI platforms are part of the AI layer?',
    a: 'Premium is designed to support discoverability across AI answer engines and discovery platforms such as ChatGPT, Perplexity, Grok, Google Gemini, and Microsoft Copilot.',
  },
  {
    q: 'Can you guarantee what AI systems will say?',
    a: 'No company can fully control AI-generated answers. Mindscale Echo focuses on creating and distributing structured, authoritative signals that can improve discoverability and visibility over time.',
  },
  {
    q: 'Do I approve the press release before it goes out?',
    a: 'Yes. Customers review and approve the release before distribution.',
  },
  {
    q: 'What happens after checkout?',
    a: 'After checkout, customers submit their article, company details, and announcement information. Mindscale Echo prepares the release draft, sends it for approval, then distributes it after approval.',
  },
  {
    q: 'Do I get “as seen in” badges?',
    a: 'Yes. Customers receive badge assets and placement links they can use on their website, sales materials, and social channels.',
  },
  {
    q: 'Is this a PR agency?',
    a: 'Mindscale Echo is a self-serve media distribution product with AI-assisted writing, distribution, reporting, and optional follow-up pitching.',
  },
];

export const ANNOUNCEMENT_TYPES = [
  'Local news coverage',
  'Business opening',
  'Expansion or new location',
  'Executive hire',
  'Funding announcement',
  'Award or recognition',
  'Partnership',
  'Product or service launch',
  'Community feature',
  'Other milestone',
];
