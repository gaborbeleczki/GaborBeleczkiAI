import React, { useState, useRef } from 'react';
import { CV_DATA } from '../../data';
import { Mail, ArrowRight, LayoutGrid, Layers, Hexagon, ChevronRight, Globe, Plus, Cpu, Sparkles, Brain, Award } from 'lucide-react';
import { SkillCloud } from '../SkillCloud';

export const StructuralTheme: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'experience' | 'skills'>('overview');
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCardClick = () => {
    setActiveTab('experience');
    setTimeout(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const achievements = [
    "Transformed client apps with 100k+ daily visitors",
    "Driving end-to-end AI automation strategy",
    "Led adoption of citizen-driven tools (Alteryx, Tableau)",
    "Deployed complex global procedures to Budapest hub"
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white pb-32 pt-20 relative overflow-x-hidden">
      
      {/* Structural Background Grid */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      {/* Ambient Glows */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-slate-400/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* Structural Nav - Fixed & Glass */}
      <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/30 bg-white/90 backdrop-blur-xl shadow-lg transition-all duration-300">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-blue-950 text-white flex items-center justify-center font-display font-black text-lg shadow-lg rounded-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
               GB
             </div>
             <div className="leading-tight hidden sm:block">
               <h1 className="font-display font-black text-lg uppercase tracking-tighter text-blue-950">Gábor Béleczki</h1>
               <p className="font-mono text-[10px] text-blue-600 uppercase tracking-widest font-bold">AI Program Manager</p>
             </div>
          </div>
          <div className="flex gap-1 md:gap-2 p-1 bg-slate-100/50 rounded-lg backdrop-blur-md border border-white/40">
             {['overview', 'experience', 'skills'].map((tab) => (
               <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`uppercase font-black tracking-widest text-[10px] px-5 py-2.5 rounded-md transition-all duration-300 ${
                  activeTab === tab 
                  ? 'bg-white text-blue-950 shadow-md border border-slate-100' 
                  : 'text-slate-500 hover:text-blue-900 hover:bg-white/50'
                }`}
               >
                 {tab}
               </button>
             ))}
          </div>
           <a href={`mailto:${CV_DATA.email}`} className="hidden md:flex items-center gap-2 bg-blue-950 text-white px-5 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-blue-800 transition-all shadow-lg hover:shadow-blue-900/20 hover:-translate-y-0.5">
             Contact <ArrowRight size={12} />
           </a>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto relative z-10">
        
        {/* Hero Section */}
        <header className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-16 pb-12 px-6 lg:px-12 items-center">
           <div className="lg:col-span-7 space-y-8 animate-in slide-in-from-bottom-8 duration-700">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-50/80 backdrop-blur-sm rounded-full border border-blue-100/50">
                 <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                 <span className="font-mono text-[10px] font-bold text-blue-700 uppercase tracking-widest">Architecting Intelligence</span>
              </div>
              
              <h2 className="text-6xl lg:text-7xl xl:text-8xl font-display font-black text-slate-900 leading-[0.9] tracking-tight">
                SYSTEMS <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-400">OF</span> <br/>
                INNOVATION.
              </h2>
              
              <p className="text-xl text-slate-600 font-medium max-w-xl leading-relaxed pl-6 border-l-4 border-blue-500/30">
                 Constructing the bridge between enterprise infrastructure and generative AI. Over 10 years of strategic execution in global markets.
              </p>

              <div className="flex flex-wrap gap-4 pt-4">
                 <GlassStat icon={<Globe size={18} />} label="Location" value="Budapest, HU" />
                 <GlassStat icon={<Layers size={18} />} label="Focus" value="Strategy & Execution" />
                 <GlassStat icon={<Cpu size={18} />} label="Core" value="AI & Automation" />
              </div>
           </div>

           <div className="lg:col-span-5 relative group animate-in slide-in-from-right-8 duration-1000">
              <div className="relative z-20 rounded-[2rem] overflow-hidden border-8 border-white/40 shadow-2xl bg-white/10 backdrop-blur-sm">
                <img 
                  src={CV_DATA.imageUrl} 
                  alt="Profile" 
                  className="w-full h-auto object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-950/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6">
                   <div className="p-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl">
                      <p className="text-white font-display font-black text-xl">Gábor Béleczki</p>
                      <p className="text-blue-200 font-mono text-xs uppercase tracking-widest mt-1">Morgan Stanley • 2015-Present</p>
                   </div>
                </div>
              </div>
              
              {/* Abstract Glass Decor behind image */}
              <div className="absolute -top-12 -right-12 w-full h-full border-2 border-blue-900/10 rounded-[2.5rem] z-10"></div>
              <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl z-0"></div>
           </div>
        </header>

        <div className="px-6 lg:px-12 pb-24" ref={contentRef}>
          
          {activeTab === 'overview' && (
             <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                   
                   {/* Primary Card */}
                   <div 
                      onClick={handleCardClick}
                      className="col-span-1 relative overflow-hidden rounded-[2.5rem] p-10 group cursor-pointer hover:-translate-y-2 transition-all duration-500 shadow-2xl shadow-blue-900/30"
                   >
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-[#0B1121] to-blue-900 z-0"></div>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full group-hover:bg-blue-500/20 transition-all duration-700"></div>
                      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 blur-[60px] rounded-full"></div>
                      
                      <div className="relative z-10 flex flex-col justify-between h-full min-h-[340px]">
                         <div className="flex justify-between items-start">
                            <div className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-inner group-hover:bg-white/10 transition-colors duration-300">
                               <LayoutGrid size={32} className="text-blue-100" />
                            </div>
                            <div className="px-3 py-1 rounded-full border border-blue-400/30 bg-blue-500/10 text-[10px] font-bold uppercase tracking-widest text-blue-200 backdrop-blur-sm">
                               Core Focus
                            </div>
                         </div>
                         
                         <div className="mt-8">
                           <h3 className="font-display font-black text-3xl mb-4 text-white tracking-tight leading-tight">
                             AI Strategy & <br/>
                             <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">Architecture</span>
                           </h3>
                           <p className="text-blue-100/70 leading-relaxed font-medium text-sm border-l-2 border-blue-500/50 pl-4">
                             Orchestrating high-level vision and execution roadmaps for enterprise AI adoption.
                           </p>
                         </div>
                         
                         <div className="mt-8 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-white/50 group-hover:text-white transition-colors">
                            <span className="w-8 h-[1px] bg-white/20 group-hover:w-12 group-hover:bg-blue-400 transition-all duration-500"></span>
                            Explore Timeline
                            <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 delay-100" />
                         </div>
                      </div>
                   </div>

                   {/* Secondary Cards */}
                   <GlassCard 
                     onClick={handleCardClick}
                     icon={<Layers size={32} />} 
                     title="Governance" 
                     desc="Defining ethical standards, compliance, and risk frameworks for responsible usage."
                   />
                   <GlassCard 
                     onClick={handleCardClick}
                     icon={<Hexagon size={32} />} 
                     title="Transformation" 
                     desc="Driving digital tooling agendas and internal workflow renovations across global hubs."
                   />
                </div>

                <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[2rem] p-10 shadow-lg shadow-slate-200/50">
                   <h3 className="font-mono text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-4">
                      <span className="w-8 h-[2px] bg-slate-300"></span>
                      Key Impact Indicators
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {achievements.map((item, i) => (
                        <div key={i} className="flex items-start gap-4 p-5 rounded-2xl bg-white/50 border border-white/60 hover:border-blue-200 hover:shadow-lg transition-all duration-300 group">
                           <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors mt-1">
                              <Plus size={16} strokeWidth={3} />
                           </div>
                           <span className="font-bold text-slate-700 text-sm leading-snug group-hover:text-slate-900">{item}</span>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'experience' && (
            <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-5xl mx-auto">
               <div className="flex items-end justify-between border-b border-slate-200 pb-6">
                  <div>
                    <h2 className="text-4xl lg:text-5xl font-display font-black uppercase text-blue-950 mb-2">Timeline</h2>
                    <p className="text-slate-500 font-medium">A structured history of execution.</p>
                  </div>
                  <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-mono font-bold text-sm">2013 — 2025</span>
               </div>

               <div className="relative pl-8 md:pl-0">
                  {/* Glass Spine */}
                  <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-950 via-blue-200 to-slate-100 transform md:-translate-x-1/2"></div>
                  
                  <div className="space-y-16">
                    {CV_DATA.experiences.map((exp, idx) => {
                      const isAI = exp.role.toLowerCase().includes('ai');
                      const isLeft = idx % 2 === 0;
                      
                      return (
                        <div key={exp.id} className={`relative flex flex-col md:flex-row gap-8 ${isLeft ? 'md:flex-row-reverse' : ''} group`}>
                           
                           {/* Center Node */}
                           <div className="absolute left-[20px] md:left-1/2 top-8 w-6 h-6 -ml-[11px] md:-ml-3 rounded-full border-4 border-white shadow-lg z-20 transition-all duration-500 group-hover:scale-125
                             bg-gradient-to-br from-blue-600 to-blue-950">
                           </div>

                           {/* Spacer for other side */}
                           <div className="hidden md:block flex-1"></div>

                           {/* Content Card */}
                           <div className="flex-1 ml-12 md:ml-0">
                              <div className={`
                                 relative p-8 rounded-[2rem] border border-white/60 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300
                                 ${isAI 
                                   ? 'bg-gradient-to-br from-white/90 to-blue-50/50 backdrop-blur-xl border-t-4 border-t-blue-600' 
                                   : 'bg-white/80 backdrop-blur-xl border-t-4 border-t-slate-300'
                                 }
                              `}>
                                 {isAI && (
                                   <div className="absolute -top-3 right-8 px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-blue-600/30">
                                     AI Focused
                                   </div>
                                 )}

                                 <div className="mb-6">
                                    <span className="font-mono text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">{exp.period}</span>
                                    <h3 className="text-2xl font-display font-black text-slate-900 leading-tight mb-1 group-hover:text-blue-700 transition-colors">{exp.role}</h3>
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">{exp.company}</p>
                                 </div>
                                 
                                 <ul className="space-y-3 mb-6">
                                    {exp.description.map((d, i) => (
                                      <li key={i} className="flex gap-3 text-slate-600 text-sm leading-relaxed group/item">
                                         <ChevronRight size={14} className="shrink-0 mt-1 text-blue-400 group-hover/item:text-blue-600 transition-colors" />
                                         {d}
                                      </li>
                                    ))}
                                 </ul>
                                 
                                 <div className="flex flex-wrap gap-2">
                                   {exp.skills.map(s => (
                                     <span key={s} className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase">
                                       {s}
                                     </span>
                                   ))}
                                 </div>
                              </div>
                           </div>
                        </div>
                      )
                    })}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
              
              {/* AI Strategy Hero Section */}
              {CV_DATA.skillCategories.filter(c => c.name === 'AI & Strategy').map((cat, idx) => (
                <div key={idx} className="relative overflow-hidden rounded-[2.5rem] bg-[#0B1121] p-8 lg:p-12 shadow-2xl shadow-blue-900/10 border border-slate-800/60 group isolate hover:shadow-blue-900/20 transition-all duration-700">
                    
                    {/* Subtle Tech Grid Background */}
                    <div className="absolute inset-0 opacity-[0.03]" 
                         style={{ 
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', 
                            backgroundSize: '50px 50px' 
                         }}>
                    </div>
                    
                    {/* Deep Ambient Glows */}
                    <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen"></div>
                    <div className="absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen"></div>

                    <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                       
                       {/* Text Content */}
                       <div className="lg:w-1/3 text-center lg:text-left space-y-8">
                          <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm">
                             <Sparkles size={12} className="text-blue-400" />
                             <span className="text-blue-200/80 font-mono text-[10px] font-bold uppercase tracking-widest">Core Competency</span>
                          </div>
                          
                          <div>
                            <h3 className="text-5xl lg:text-6xl font-display font-black text-white tracking-tight leading-[0.9] mb-4">
                              AI & <br/> 
                              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-200 to-white">Strategy</span>
                            </h3>
                            <div className="h-1 w-12 bg-blue-600 rounded-full mx-auto lg:mx-0"></div>
                          </div>
                          
                          <p className="text-slate-400 font-medium text-sm leading-relaxed max-w-sm mx-auto lg:mx-0">
                            Strategic frameworks and technical competencies driving the next generation of intelligent enterprise systems.
                          </p>

                          <div className="hidden lg:flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 pt-4">
                             <div className="flex gap-1">
                               <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                               <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 animate-pulse delay-75"></div>
                               <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20 animate-pulse delay-150"></div>
                             </div>
                             System Active
                          </div>
                       </div>
                       
                       {/* Skill Cloud Container */}
                       <div className="lg:w-2/3 w-full">
                          <div className="bg-slate-950/30 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 lg:p-12 shadow-inner relative overflow-hidden">
                              {/* Inner Glass Highlight */}
                              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                              
                              <div className="relative z-10">
                                <SkillCloud skills={cat.items} theme="structural" />
                              </div>
                              
                              {/* Decorative Corners */}
                              <div className="absolute top-4 right-4 w-3 h-3 border-t border-r border-white/20"></div>
                              <div className="absolute bottom-4 left-4 w-3 h-3 border-b border-l border-white/20"></div>
                              
                              <div className="absolute bottom-4 right-6 text-white/10">
                                 <Cpu size={24} />
                              </div>
                          </div>
                       </div>
                    </div>
                </div>
              ))}
              
              {/* Product and Tools Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                
                {/* Product & Leadership */}
                {CV_DATA.skillCategories.filter(c => c.name === 'Product & Leadership').map((cat, idx) => (
                  <div key="prod" className="bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/60 shadow-xl shadow-slate-200/50 flex flex-col hover:-translate-y-2 transition-all duration-500 h-full">
                     <h3 className="font-display font-black text-xl uppercase tracking-widest mb-8 text-slate-900 border-b border-slate-200 pb-4 h-auto md:h-16 flex items-end">
                        {cat.name}
                     </h3>
                     <div className="flex flex-wrap gap-3">
                       {cat.items.map((skill) => (
                         <div key={skill} className="px-5 py-2.5 rounded-full font-bold text-xs bg-white border border-slate-100 text-slate-600 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-default">
                            {skill}
                         </div>
                       ))}
                     </div>
                  </div>
                ))}

                {/* Tools & Technical */}
                {CV_DATA.skillCategories.filter(c => c.name === 'Tools & Technical').map((cat, idx) => (
                  <div key="tools" className="bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/60 shadow-xl shadow-slate-200/50 flex flex-col hover:-translate-y-2 transition-all duration-500 h-full">
                     <h3 className="font-display font-black text-xl uppercase tracking-widest mb-8 text-slate-900 border-b border-slate-200 pb-4 h-auto md:h-16 flex items-end">
                        {cat.name}
                     </h3>
                     <div className="flex flex-wrap gap-3">
                       {cat.items.map((skill) => (
                         <div key={skill} className="px-5 py-2.5 rounded-full font-bold text-xs bg-white border border-slate-100 text-slate-600 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-default">
                            {skill}
                         </div>
                       ))}
                     </div>
                  </div>
                ))}
              </div>

              {/* Education Card (Full Width Below) */}
              <div className="bg-gradient-to-br from-slate-100 to-white backdrop-blur-xl p-10 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/50 hover:-translate-y-2 transition-all duration-500">
                  <div className="flex flex-col md:flex-row gap-12 items-center justify-between">
                     <div className="flex-1 space-y-8">
                         <h3 className="font-display font-black text-3xl uppercase tracking-widest text-slate-900">
                           Education
                         </h3>
                         <div className="space-y-6">
                            {CV_DATA.education.map((edu, i) => (
                              <div key={i} className="pl-6 border-l-4 border-blue-600">
                                 <h4 className="text-2xl font-bold text-slate-800 leading-tight">{edu.school}</h4>
                                 <p className="text-blue-600 font-medium uppercase tracking-widest text-sm mt-1">{edu.degree}</p>
                                 <p className="text-slate-400 text-xs font-bold uppercase mt-1">{edu.period}</p>
                              </div>
                            ))}
                         </div>
                     </div>
                     
                     <div className="bg-white/80 p-8 rounded-[2rem] border border-slate-200 shadow-lg text-center w-full md:w-auto min-w-[240px]">
                         <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mx-auto mb-4">
                            <Award size={32} strokeWidth={1.5} /> 
                         </div>
                         <p className="font-display font-black text-6xl text-blue-950">10+</p>
                         <p className="font-mono text-xs uppercase tracking-widest text-slate-400 font-bold mt-2">Years Experience</p>
                     </div>
                  </div>
              </div>
            </div>
          )}
          
        </div>

      </main>
      
      {/* Footer Strip */}
      <footer className="border-t border-slate-200/50 bg-white/40 backdrop-blur-md py-8 text-center relative z-10">
         <p className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-widest">Constructed for Impact • 2025</p>
      </footer>
    </div>
  );
};

// Helper Components for Cleaner Code
const GlassStat = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="flex items-center gap-3 px-5 py-3 bg-white/60 backdrop-blur-md rounded-xl border border-white/50 shadow-sm hover:shadow-md transition-shadow cursor-default">
    <div className="text-blue-700">{icon}</div>
    <div>
      <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">{label}</p>
      <p className="font-bold text-sm text-slate-800 leading-none">{value}</p>
    </div>
  </div>
);

const GlassCard = ({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className="bg-white/70 backdrop-blur-xl p-10 rounded-[2rem] border border-white/60 shadow-xl shadow-slate-200/50 group cursor-pointer hover:-translate-y-2 transition-transform duration-300 flex flex-col justify-between min-h-[340px]"
  >
    <div className="p-3 bg-blue-50/50 w-fit rounded-xl border border-blue-100/50 mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
      {icon}
    </div>
    <div>
      <h3 className="font-display font-black text-2xl uppercase mb-4 text-slate-800">{title}</h3>
      <p className="text-slate-600 leading-relaxed font-medium text-sm">{desc}</p>
    </div>
    <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-xs mt-6 text-slate-400 group-hover:text-blue-700 transition-colors">
      Details <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
    </div>
  </div>
);