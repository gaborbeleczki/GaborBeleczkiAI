import React, { useState } from 'react';

interface SkillMeta {
  weight: number;
  description: string;
}

const AI_SKILLS_META: Record<string, SkillMeta> = {
  "AI Strategy": { 
    weight: 2, 
    description: "Orchestrating the high-level vision and roadmap for enterprise AI adoption within Morgan Stanley." 
  },
  "Generative AI Integration": { 
    weight: 1.9, 
    description: "Embedding LLMs and intelligent agents into complex financial workflows to automate high-value tasks." 
  },
  "AI Governance": { 
    weight: 1.5, 
    description: "Defining ethical standards, compliance, and risk frameworks for responsible AI usage in banking." 
  },
  "Evaluation Design": { 
    weight: 1.3, 
    description: "Creating rigorous metrics and frameworks to measure the accuracy, bias, and performance of AI outputs." 
  },
  "Prompt Engineering": { 
    weight: 1.2, 
    description: "Optimizing model interactions to achieve precise, consistent, and high-quality results from LLMs." 
  },
  "AI Literacy": { 
    weight: 1, 
    description: "Empowering teams across the organization with the knowledge to leverage AI tools effectively and safely." 
  },
};

interface SkillCloudProps {
  skills: string[];
  theme: 'futurist' | 'executive' | 'creative' | 'structural';
}

export const SkillCloud: React.FC<SkillCloudProps> = ({ skills, theme }) => {
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  const themeStyles = {
    futurist: {
      text: 'text-purple-600',
      bg: 'bg-purple-50',
      tooltipContainer: 'bg-slate-900 text-white border-slate-700 p-4 rounded-xl',
      node: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] rounded-xl'
    },
    executive: {
      text: 'text-slate-900',
      bg: 'bg-slate-50',
      tooltipContainer: 'bg-white text-slate-800 border-slate-200 shadow-xl p-4 rounded-lg',
      node: 'hover:bg-slate-900 hover:text-white rounded-lg'
    },
    creative: {
      text: 'text-slate-800',
      bg: 'bg-pastel-lavender/30',
      tooltipContainer: 'bg-white text-slate-700 border-pastel-lavender shadow-lg p-4 rounded-[1rem]',
      node: 'hover:scale-110 rounded-[1rem]'
    },
    structural: {
      text: 'text-slate-700',
      bg: 'bg-white border border-slate-200',
      tooltipContainer: 'bg-slate-900 text-white border border-blue-500/50 shadow-2xl p-5 rounded-lg',
      node: 'hover:border-blue-600 hover:text-blue-700 rounded-full transition-colors shadow-sm'
    }
  }[theme];

  return (
    <div className="relative flex flex-wrap gap-x-4 gap-y-3 items-center justify-center py-6 px-4">
      {skills.map((skill) => {
        const meta = AI_SKILLS_META[skill] || { weight: 1, description: `Specialized focus in ${skill}.` };
        const size = meta.weight === 2 ? 'text-lg md:text-xl' : meta.weight >= 1.5 ? 'text-base md:text-lg' : 'text-xs md:text-sm';
        
        return (
          <div 
            key={skill}
            className="relative group cursor-default"
            onMouseEnter={() => setHoveredSkill(skill)}
            onMouseLeave={() => setHoveredSkill(null)}
          >
            <span className={`
              inline-block font-bold font-sans uppercase tracking-widest transition-all duration-300 px-6 py-3
              ${size} ${themeStyles.text} ${themeStyles.bg} ${themeStyles.node}
              ${hoveredSkill === skill ? 'opacity-100' : 'opacity-90'}
            `}>
              {skill}
            </span>

            {/* Tooltip */}
            <div className={`
              absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-4 w-72 text-xs font-medium leading-relaxed
              pointer-events-none transition-all duration-300 transform origin-bottom border
              ${themeStyles.tooltipContainer}
              ${hoveredSkill === skill ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'}
            `}>
              {theme === 'structural' ? (
                 <>
                   <div className="flex items-center justify-between mb-3 border-b border-white/20 pb-2">
                      <p className="font-display font-black uppercase tracking-wider text-blue-200">{skill}</p>
                   </div>
                   <p className="text-slate-300 leading-relaxed font-sans">{meta.description}</p>
                   {/* Decorative technical markers */}
                   <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-blue-400 opacity-50"></div>
                   <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-blue-400 opacity-50"></div>
                 </>
              ) : (
                 <>
                  <p className="mb-1 font-black uppercase tracking-tighter opacity-70">{skill}</p>
                  {meta.description}
                 </>
              )}
              
              {/* Tooltip Arrow */}
              <div className={`absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-8 border-transparent border-t-current ${theme === 'structural' ? 'text-slate-900' : 'text-inherit'}`} style={theme !== 'structural' ? {color: 'inherit'} : {}} />
            </div>
          </div>
        );
      })}
    </div>
  );
};