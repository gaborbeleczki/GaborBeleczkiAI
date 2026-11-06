// Single source of truth for the site's content.
// Both the static page and the 3D studio's screen modules read from here.
// Copy comes from the live portfolio (Applied AI in Finance).

export interface Kpi {
  value: string;
  label: string;
}

export interface Duty {
  n: string;
  title: string;
  text: string;
}

export interface Step {
  n: string;
  title: string;
  text: string;
}

export interface Position {
  k: number;
  years: string;
  start: number;
  end: number;
  short: string;
  band: 0 | 1 | 2;
  title: string;
  org: string;
  summary: string;
  highlights: { h: string; t: string }[];
  tools: string[];
}

export interface CaseStudy {
  n: string;
  kicker: string;
  title: string;
  summary: string;
  did: string[];
  outcomes: { v: string; l: string }[];
  tags: string[];
}

export interface Tool {
  sym: string;
  name: string;
  group: 'a' | 'k' | 'd';
}

export interface Faq {
  q: string;
  a: string;
}

export const profile = {
  name: 'Gábor Béleczki',
  firstName: 'Gábor',
  role: 'AI Program Manager',
  org: 'Morgan Stanley',
  orgUnit: 'Finance',
  location: 'Budapest, Hungary',
  email: 'beleczki.gabor@gmail.com',
  linkedin: 'https://www.linkedin.com/in/gaborbeleczki/',
  tagline: 'Applied AI in Finance',
  intro:
    'I take enterprise AI from use case to daily use: discovery, enablement, governance and adoption across a regulated Finance function.',
  workingWith: ['Claude Code', 'GitHub Copilot', 'Claude', 'ChatGPT', 'M365 Copilot', 'Copilot Studio'],
  roleSince: 'Since Sep 2025',
  roleSummary:
    'I own End User AI Strategy for Morgan Stanley Finance, including governance and enablement for end-user solutions: which tools the function adopts, where agentic automation goes first, and whether people actually use it.',
  openTo: {
    title: 'Open to Applied AI and AI enablement roles',
    text: 'Including AI Product and AI academy roles, in financial services and beyond. Budapest, remote or hybrid.',
  },
};

export const kpis: Kpi[] = [
  { value: '2,500+', label: 'Finance users trained in AI programmes' },
  { value: '1,000+', label: 'Use cases in pipeline, including agentic solutions' },
  { value: '2×', label: 'Weekly active adoption in under 3 months' },
  { value: '50+', label: 'Solutions submitted to the AI Solution Platform' },
  { value: '80+', label: 'AI innovators and ambassadors in a global network' },
];

export const duties: Duty[] = [
  {
    n: '01',
    title: 'Strategy and delivery',
    text: 'Define and execute the end-to-end AI automation strategy: vision, roadmap and delivery for scaling agentic task automation across Finance and adjacent domains.',
  },
  {
    n: '02',
    title: 'Tool evaluation',
    text: 'Lead structured evaluation of AI tools (ChatGPT, Claude, M365 Copilot and Copilot Studio), assessing capability, fit and risk to inform enterprise tooling decisions.',
  },
  {
    n: '03',
    title: 'Finance AI ambassador',
    text: "Act as Finance's AI ambassador in enterprise-wide initiatives, translating business pain points into a prioritised pipeline of automation opportunities.",
  },
  {
    n: '04',
    title: 'Governance and metrics',
    text: 'Set the governance model, performance metrics and delivery standards for responsible AI automation: compliance, auditability and measurable value.',
  },
  {
    n: '05',
    title: 'Adoption at scale',
    text: 'Drive adoption through pilots, enablement and the Global AI Innovator programme (80+ innovators and ambassadors), embedding AI into daily Finance operations.',
  },
];

export const approach = {
  title: 'Small wins grow into waves',
  lead: 'Data comes first. Culture makes room to experiment. Small, tangible wins grow into larger waves, ROI makes the case for change, until adoption runs on its own.',
  steps: [
    { n: '01', title: 'Data', text: 'Get the data foundation right before choosing tools.' },
    { n: '02', title: 'Culture', text: 'Build the trust and habits that make AI part of daily work.' },
    { n: '03', title: 'Small wins', text: 'Tangible results grow into larger waves.' },
    { n: '04', title: 'ROI', text: 'Measured value justifies the change.' },
    { n: '05', title: 'Flow state', text: 'Adoption runs on its own.' },
  ] as Step[],
};

export const programmes = [
  'AI training tailored for Finance audiences',
  'Global AI Immersion Week, 2,500 attendees',
  'Bi-weekly executive coaching',
  'Regular global tooling updates',
  '2× weekly active adoption in under 3 months',
];

export const bands = ['Finance & markets', 'Product & delivery', 'AI'] as const;

export const positions: Position[] = [
  {
    k: 1,
    years: '2009–12',
    start: 2009,
    end: 2013,
    short: 'BA · ELTE',
    band: 0,
    title: 'Regional Analyst BA',
    org: 'Eötvös Loránd University',
    summary: 'Regional Analyst BA, 2009–2012.',
    highlights: [{ h: 'Education', t: 'Eötvös Loránd University, Regional Analyst BA, 2009–2012.' }],
    tools: [],
  },
  {
    k: 2,
    years: '2013–15',
    start: 2013,
    end: 2015.5,
    short: 'Dealogic',
    band: 0,
    title: 'Debt Capital Market Analyst / Associate',
    org: 'Dealogic',
    summary: 'European Medium Term Note and Commercial Paper market analysis for leading investment banks.',
    highlights: [
      {
        h: 'Market coverage',
        t: 'European Medium Term Note and Commercial Paper market analysis for industry-leading investment banks.',
      },
    ],
    tools: [],
  },
  {
    k: 3,
    years: '2015–20',
    start: 2015.5,
    end: 2020.4,
    short: 'Valuation Control',
    band: 0,
    title: 'Valuation Control: Analyst to Equity Model Control Manager',
    org: 'Morgan Stanley',
    summary:
      "Managed a team of five, led independent valuation review of the firm's complex equity exposure, and introduced Agile to the global team.",
    highlights: [
      {
        h: 'Team and valuation',
        t: "Managed a team of five, led independent valuation review of the firm's complex equity exposure, and introduced the Agile framework to the global team.",
      },
    ],
    tools: ['Agile'],
  },
  {
    k: 4,
    years: '2020–21',
    start: 2020.4,
    end: 2022,
    short: 'Product Owner',
    band: 1,
    title: 'Product Owner',
    org: 'Morgan Stanley',
    summary:
      'Led the local Change and Transformation team across three squads and drove citizen-developer tooling adoption with Alteryx and Tableau.',
    highlights: [
      {
        h: 'Squad leadership',
        t: 'Led the local Change and Transformation team across three squads, translating stakeholder requirements into strategic outcomes.',
      },
      { h: 'Citizen-driven tooling', t: 'Led adoption of Alteryx and Tableau, plus UAT and issue management with IT and end users.' },
    ],
    tools: ['Alteryx', 'Tableau'],
  },
  {
    k: 5,
    years: '2022–25',
    start: 2022,
    end: 2025.67,
    short: 'Senior PO / Lead BA',
    band: 1,
    title: 'Senior Product Owner / Lead Business Analyst (VP)',
    org: 'Morgan Stanley',
    summary:
      'Integrated Generative AI solutions into Valuation Control workflows, drove the Global Digital Tooling agenda, and led the transformation of wealth management applications with 100k+ daily unique visitors.',
    highlights: [
      { h: 'Generative AI integration', t: 'Brought GenAI solutions into the Valuation Control workflows.' },
      { h: 'Global Digital Tooling', t: 'Drove the agenda with a focus on internal workflow transformation.' },
      {
        h: 'Client platform transformation',
        t: 'Led the transformation of client-facing wealth management applications with over 100k daily unique visitors.',
      },
    ],
    tools: [],
  },
  {
    k: 6,
    years: '2025–',
    start: 2025.67,
    end: 2027,
    short: 'AI Program Manager',
    band: 2,
    title: 'AI Program Manager',
    org: 'Morgan Stanley · Finance',
    summary:
      'End-to-end AI automation strategy for Finance: tool evaluation, governance, adoption and the AI Risk Assessment & Solution Platform.',
    highlights: [
      {
        h: 'Strategy and delivery',
        t: 'Define and execute the end-to-end AI automation strategy: vision, roadmap and delivery for scaling agentic task automation across Finance and adjacent domains.',
      },
      {
        h: 'Tool evaluation',
        t: 'Lead structured evaluation of AI tools, from ChatGPT and Claude to M365 Copilot and Copilot Studio, assessing capability, fit and risk to inform enterprise tooling decisions.',
      },
      {
        h: 'Use-case pipeline',
        t: 'Represent Finance in enterprise-wide initiatives, translating business pain points into a prioritised pipeline of 1,000+ automation opportunities, including agentic solutions.',
      },
      {
        h: 'Governance and metrics',
        t: 'Set the governance model, performance metrics and delivery standards for responsible AI automation; shaping the AI Risk Assessment & Solution Platform, with 50+ solutions submitted.',
      },
      {
        h: 'Training and adoption',
        t: 'Designed and ran AI training for Finance audiences, including a Global AI Immersion Week with 2,500 attendees, plus bi-weekly executive coaching. Weekly active adoption doubled in under three months.',
      },
      {
        h: 'Global AI Innovator programme',
        t: 'Co-organised a global network of 80+ AI innovators and ambassadors who run a decentralised network of AI champions, delivering innovation hub-and-spoke: training out from the hub, use cases back for reuse.',
      },
    ],
    tools: ['M365 Copilot', 'Copilot Studio', 'Copilot Cowork', 'Claude', 'Claude Code', 'ChatGPT', 'Codex', 'GitHub Copilot'],
  },
];

export const cases: CaseStudy[] = [
  {
    n: '01',
    kicker: 'Current focus',
    title: 'AI Risk Assessment & Solution Platform',
    summary: 'One governed front door for building, assessing and sharing internal AI solutions.',
    did: [
      'Shaping the platform with technology partners, from prototype to live service.',
      'Coordinating multiple internal stakeholders behind a single route for intake, risk assessment and sharing.',
      'Building responsible-AI standards into how solutions are submitted, reviewed and reused.',
    ],
    outcomes: [
      { v: 'Global', l: 'Finance coverage' },
      { v: '50+', l: 'Solutions already submitted' },
    ],
    tags: ['AI governance', 'Risk assessment', 'Platform product', 'Stakeholder alignment'],
  },
  {
    n: '02',
    kicker: 'Strategy',
    title: 'Agentic automation pipeline',
    summary: 'Vision, roadmap and delivery for scaling agentic task automation across Finance and adjacent domains.',
    did: [
      'Translate business pain points into a prioritised pipeline of automation opportunities.',
      'Set the governance model, performance metrics and delivery standards.',
      'Represent Finance as its AI ambassador in enterprise-wide initiatives.',
    ],
    outcomes: [{ v: '1,000+', l: 'Use cases in pipeline, including agentic solutions' }],
    tags: ['Agentic automation', 'Roadmapping', 'Prioritisation', 'Performance metrics'],
  },
  {
    n: '03',
    kicker: 'Evaluation',
    title: 'Enterprise AI tool evaluation',
    summary: 'Structured evaluation of AI tools to inform enterprise tooling decisions.',
    did: [
      'Assess capability, fit and risk across ChatGPT, Claude, M365 Copilot and Copilot Studio.',
      'Run pilots to test tools in Finance workflows before scaling.',
      'Feed findings into enterprise tooling decisions.',
    ],
    outcomes: [{ v: 'Capability · Fit · Risk', l: 'Evaluation lenses' }],
    tags: ['ChatGPT', 'Claude', 'M365 Copilot', 'Copilot Studio', 'AI evaluation'],
  },
  {
    n: '04',
    kicker: 'Adoption',
    title: 'Finance AI adoption programme',
    summary: 'AI training tailored for Finance audiences, built to move tools from licence to daily use.',
    did: [
      'Designed and ran AI training programmes tailored for Finance audiences.',
      'Organised a Global AI Immersion Week with 2,500 attendees.',
      'Publish regular global tooling updates to keep teams current.',
      'Scaled through the Global AI Innovator programme and its AI champions.',
    ],
    outcomes: [
      { v: '2,500+', l: 'Users trained' },
      { v: '2×', l: 'Weekly active adoption in under 3 months' },
    ],
    tags: ['Enablement', 'Training design', 'Change management'],
  },
  {
    n: '05',
    kicker: 'Network',
    title: 'Global AI Innovator programme',
    summary:
      'A global network of innovators and ambassadors who run a decentralised network of AI champions, delivering innovation hub-and-spoke.',
    did: [
      'Co-organised the programme for a global network of 80+ AI innovators and ambassadors.',
      'Innovators and ambassadors drive a decentralised network of AI champions inside their teams.',
      'The hub sends out training, tooling and standards; use cases come back to be shared and reused.',
      'Works hand in hand with the Finance AI adoption programme.',
    ],
    outcomes: [
      { v: '80+', l: 'Innovators and ambassadors, globally' },
      { v: 'Hub & spoke', l: 'Delivery model' },
    ],
    tags: ['Community building', 'AI champions', 'Hub-and-spoke', 'Change management'],
  },
  {
    n: '06',
    kicker: 'Leadership',
    title: 'Executive education',
    summary: 'Hands-on AI education for senior management across the globe.',
    did: ['Run bi-weekly executive coaching sessions.', 'Engage directly in senior coaching and executive education.'],
    outcomes: [{ v: 'Bi-weekly', l: 'Executive coaching sessions' }],
    tags: ['Executive education', 'AI literacy', 'Stakeholder management'],
  },
  {
    n: '07',
    kicker: 'Hands-on',
    title: 'Prototypes and automations',
    summary: 'Environments, prototypes and automations, built as an advanced user alongside technology teams.',
    did: [
      'Set up Copilot Studio environments for hackathons, with prototype solutions.',
      'Prototyped AI solution platforms in partnership with technology teams.',
      'Built internal skill repositories and workflow automations.',
    ],
    outcomes: [],
    tags: ['Copilot Studio', 'Claude Code', 'GitHub Copilot', 'Power Platform', 'Prompt libraries'],
  },
];

export const toolGroups = [
  { id: 'a', name: 'AI assistants and agents' },
  { id: 'k', name: 'Working knowledge' },
  { id: 'd', name: 'Analytics and delivery' },
] as const;

export const tools: Tool[] = [
  { sym: 'Cl', name: 'Claude', group: 'a' },
  { sym: 'Cc', name: 'Claude Code', group: 'a' },
  { sym: 'Ch', name: 'ChatGPT', group: 'a' },
  { sym: 'Cx', name: 'Codex', group: 'a' },
  { sym: 'Gh', name: 'GitHub Copilot', group: 'a' },
  { sym: 'Mc', name: 'M365 Copilot', group: 'a' },
  { sym: 'Cw', name: 'Copilot Cowork', group: 'a' },
  { sym: 'Cs', name: 'Copilot Studio', group: 'a' },
  { sym: 'Ap', name: 'APIs / integrations', group: 'k' },
  { sym: 'Mp', name: 'MCP / tool use', group: 'k' },
  { sym: 'Ev', name: 'AI evaluation', group: 'k' },
  { sym: 'Pl', name: 'Prompt libraries', group: 'k' },
  { sym: 'Pw', name: 'Power Platform', group: 'k' },
  { sym: 'Gt', name: 'Git / GitHub', group: 'k' },
  { sym: 'Ax', name: 'Alteryx', group: 'd' },
  { sym: 'Tb', name: 'Tableau', group: 'd' },
  { sym: 'Dk', name: 'Dataiku', group: 'd' },
  { sym: 'Ag', name: 'Agile', group: 'd' },
  { sym: 'Ji', name: 'JIRA', group: 'd' },
];

export const faqs: Faq[] = [
  {
    q: 'What roles are you looking for?',
    a: 'Applied AI and AI enablement roles: embedded AI partnering with business teams, AI academy and capability building, and AI Product roles. Financial services is my background, and I am open to other industries.',
  },
  {
    q: 'How do you decide which AI opportunities are worth pursuing?',
    a: 'I start from the workflow pain point. In Finance I translate those pain points into a prioritised pipeline of automation opportunities, now more than 1,000 use cases including agentic solutions, and test tools in pilots before scaling.',
  },
  {
    q: 'How hands-on are you?',
    a: "I've built out environments for hackathons, for example in Copilot Studio with prototype solutions. I work in partnership with technology teams to prototype AI solution platforms, and I build internal skill repositories and workflow automations.",
  },
  {
    q: 'What is your technical depth?',
    a: 'I am an advanced user, not a developer. I work daily with Claude, Claude Code, ChatGPT, Codex, GitHub Copilot, M365 Copilot, Copilot Studio and Copilot Cowork, and I understand the building blocks behind them (APIs and integrations, retrieval, MCP and tool use, evaluation) well enough to scope solutions, prototype with low-code tools and work credibly with engineering teams.',
  },
  {
    q: 'How do you evaluate AI tools?',
    a: 'Through structured evaluation of capability, fit and risk. I lead this for ChatGPT, Claude, M365 Copilot and Copilot Studio to inform enterprise tooling decisions at Morgan Stanley.',
  },
  {
    q: 'How do you build AI capability in a team?',
    a: 'I design training for the audience in front of me. I designed and ran AI training programmes for Finance, organised a Global AI Immersion Week with 2,500 attendees, run bi-weekly executive coaching for senior management, and publish regular global tooling updates so teams stay current. I also co-organised a Global AI Innovator programme: 80+ innovators and ambassadors who run a decentralised network of AI champions, hub-and-spoke.',
  },
  {
    q: 'How do you drive adoption and prove value?',
    a: 'Pilots, enablement and embedding into daily operations, measured against clear performance metrics. In Finance this meant more than 2,500 users trained and weekly active adoption doubled in under three months.',
  },
  {
    q: 'How do you approach governance in a regulated environment?',
    a: 'I set the governance model, metrics and delivery standards for responsible AI automation: compliance, auditability and measurable value. The AI Risk Assessment & Solution Platform turns this into one governed front door for building, assessing and sharing internal AI solutions.',
  },
  {
    q: 'What do you bring from financial services?',
    a: 'Eleven years at Morgan Stanley across valuation control, product ownership and AI program leadership. I know how Finance teams work, what risk and compliance functions need to see, and how adoption is earned with senior stakeholders.',
  },
  { q: 'Where are you based?', a: 'Budapest, Hungary. Open to remote or hybrid roles.' },
];

// The seven folios on the studio shelf, plus the cover sheet that is on screen when you arrive.
export const folios = [
  { id: 'hello', n: '00', title: 'Hello', color: '#E9E4DA' },
  { id: 'approach', n: '01', title: 'Approach', color: '#A9B8A4' },
  { id: 'role', n: '02', title: 'Role', color: '#8FA9C4' },
  { id: 'work', n: '03', title: 'Work', color: '#1D2D3D' },
  { id: 'career', n: '04', title: 'Career', color: '#C9A27C' },
  { id: 'toolkit', n: '05', title: 'Toolkit', color: '#D9C9AE' },
  { id: 'faq', n: '06', title: 'Questions', color: '#C8432B' },
  { id: 'contact', n: '07', title: 'Contact', color: '#416180' },
] as const;

export type FolioId = (typeof folios)[number]['id'];
