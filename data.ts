import { ProfileData } from './types';

// The user has provided a custom profile image.
// Please ensure the image file is named 'profile.png' and placed in the project root directory.
const PROFILE_IMAGE_URL = "https://media.licdn.com/dms/image/v2/D4D03AQG7t065n_fuqA/profile-displayphoto-crop_800_800/B4DZnI8IxCGwAI-/0/1760012832199?e=1769644800&v=beta&t=6eBsJ-h4CD0WiRTeQRciNYZTLQd2Zq6k3hZNGxt3Go0"; 

export const CV_DATA: ProfileData = {
  name: "Gábor Béleczki",
  title: "AI Program Manager",
  email: "beleczki.gabor@gmail.com",
  phone: "+36 30 784 5221",
  location: "Budapest, Hungary",
  imageUrl: PROFILE_IMAGE_URL,
  summary: "Solving complex challenges and creating value for clients are my primary missions. I have over 10 years of experience, currently driving end-to-end AI automation strategy and scaling intelligent task automation across Finance. I focus on continuous improvement, optimizing workflows, and translating business vision into client value using cutting-edge AI technologies.",
  skillCategories: [
    {
      name: "AI & Strategy",
      items: ["Prompt Engineering", "Evaluation Design", "AI Governance", "AI Literacy", "AI Strategy", "Generative AI Integration"]
    },
    {
      name: "Product & Leadership",
      items: ["Product Vision", "Product Launch", "Agile Methodologies", "Stakeholder Management", "User Interface Design", "Change Management"]
    },
    {
      name: "Tools & Technical",
      items: ["Figma", "Adobe Analytics", "JIRA", "Tableau", "Power BI", "Alteryx", "Dataiku", "Visio"]
    }
  ],
  education: [
    {
      school: "Eötvös Loránd Tudományegyetem",
      degree: "Regional Analyst BA",
      period: "2009 - 2012"
    }
  ],
  experiences: [
    {
      id: "ai-program-manager",
      role: "AI Program Manager",
      company: "Morgan Stanley",
      period: "Sep 2025 - Present",
      location: "Budapest, Hungary",
      isCurrent: true,
      description: [
        "Drive the end-to-end AI automation strategy, defining vision, roadmap, and execution for scaling intelligent task automation across Finance and related business domains.",
        "Act as the AI ambassador for Finance, representing the function in enterprise-wide AI initiatives and translating business needs into actionable automation opportunities.",
        "Establish governance, performance metrics, and best practices for responsible AI automation, ensuring compliance, transparency, and sustainable value delivery.",
        "Champion innovation and adoption, evaluating emerging AI technologies and embedding them into Finance operations to drive productivity and strategic impact."
      ],
      skills: ["AI Strategy", "Automation", "Governance", "Innovation"]
    },
    {
      id: "vp-product-owner",
      role: "Senior Product Owner / Lead Business Analyst (VP)",
      company: "Morgan Stanley",
      period: "Jan 2022 - Sep 2025",
      location: "Budapest, Hungary",
      description: [
        "Integration of Generative AI solutions to the Valuation Control workflows.",
        "Planning and analysis for global wealth management initiatives and product launches.",
        "Driving the Global Digital Tooling agenda with a focus on internal workflow transformation.",
        "Collaborating with UX designers and product managers to enhance the online banking client journey.",
        "Leading the transformation of client-facing applications with over 100k daily unique visitors."
      ],
      skills: ["Generative AI", "Product Management", "UX Collaboration", "Digital Transformation"]
    },
    {
      id: "product-owner",
      role: "Product Owner",
      company: "Morgan Stanley",
      period: "Jul 2020 - Dec 2021",
      location: "Budapest, Hungary",
      description: [
        "Led the local Change and Transformation team, steering development projects to align with the department's strategic vision.",
        "Collaborated with three squads to translate stakeholder requirements into strategic outcomes.",
        "Led the adoption and implementation of citizen-driven tools like Alteryx and Tableau.",
        "Partnered with IT and end users to investigate, track, and resolve issues, coordinating comprehensive UAT processes."
      ],
      skills: ["Agile", "Tableau", "Alteryx", "UAT"]
    },
    {
      id: "equity-model-manager",
      role: "Equity Model Control Manager",
      company: "Morgan Stanley",
      period: "Feb 2019 - Jul 2020",
      location: "Budapest",
      description: [
        "Focused on Continuous Improvement by exploring Development Opportunities and challenging the status quo.",
        "Managed a team of five with mixed experience (0-5 years).",
        "Introduced the Agile framework to the global team.",
        "Modelled and described complex equity valuation models and related scripts."
      ],
      skills: ["Team Leadership", "Agile Implementation", "Risk Management"]
    },
    {
      id: "equity-valuation-manager",
      role: "Equity Valuation Manager - Derivative Products Team Lead",
      company: "Morgan Stanley",
      period: "Jan 2018 - Jan 2019",
      location: "Budapest",
      description: [
        "Preparation and review of independent valuation review for the firm's complex equity exposure.",
        "Development project leadership for internal system/workflow renovations.",
        "Leadership in department-wide projects and working groups."
      ],
      skills: ["Valuation", "Project Leadership"]
    },
    {
      id: "valuation-associate",
      role: "Valuation Associate",
      company: "Morgan Stanley",
      period: "Jan 2017 - Jan 2018",
      location: "Budapest",
      description: [
        "Leader of a working group involving 12 people responsible for implementing globally consistent best practices.",
        "Responsible for the deployment of two complex procedures from Global Hubs to Budapest.",
        "Management of a Junior Financial Analyst team member with a key focus on personal development."
      ],
      skills: ["Global Consistency", "Mentoring", "Process Migration"]
    },
    {
      id: "valuation-analyst",
      role: "Valuation Analyst",
      company: "Morgan Stanley",
      period: "Mar 2015 - Jan 2017",
      location: "Budapest",
      description: [
        "Developing and standardizing existing price verification processes and control framework.",
        "Saved significant working hours with various process improvements and eliminating inefficient procedures.",
        "Project work on process improvements, new systems, and functionality enhancements."
      ],
      skills: ["Process Improvement", "Financial Analysis"]
    },
    {
      id: "dealogic",
      role: "Debt Capital Market Analyst/Associate",
      company: "Dealogic",
      period: "Aug 2013 - Mar 2015",
      location: "Budapest",
      description: [
        "Responsible for the European Medium Term Note and Commercial Paper market analysis.",
        "Identified areas of improvement related to workflow and product quality.",
        "Developed and maintained client relationships."
      ],
      skills: ["Market Analysis", "Client Relations"]
    }
  ]
};