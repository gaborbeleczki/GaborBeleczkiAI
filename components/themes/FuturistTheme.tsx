import React, { useState } from 'react';
import { CV_DATA } from '../../data';
import { Brain, Globe, Mail, Phone, Cpu, ArrowRight, Award, Sparkles, Building2, History, ChevronRight } from 'lucide-react';

type TabType = 'ai' | 'ms' | 'other';

export const FuturistTheme: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('ai');

  // Explicitly ensuring no Dealogic in AI tab by checking role and specific AI keywords
  const aiExperiences = CV_DATA.experiences.filter(exp => 
    (exp.role.toLowerCase().includes('ai') || exp.description.some(d => d.toLowerCase().includes('ai'))) && 
    exp.id !== 'dealogic'
  );
  
  const msExperiences = CV_DATA.experiences.filter(exp => exp.company === 'Morgan Stanley');
  const otherExperiences = CV_DATA.experiences.filter(exp => exp.company !== 'Morgan Stanley');

  return (
    <div className="min-h-screen bg-[#F8FAFF] text-slate-800 font-sans selection:bg-purple-200">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[5%] left-[10%] w-[40vw] h-[40vw] bg-pastel-blue rounded-full blur-[140px] opacity-30 animate-float" />
        <div className="absolute bottom-[5%] right-[10%] w-[35vw] h-[35vw] bg-pastel-purple rounded-full blur-[140px] opacity-30 animate-float-delayed" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 lg:py-20">
        <header className="flex flex-col lg:flex-row gap-12 items-center mb-16">
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-pastel-blue via-pastel-purple to-pastel-pink rounded-[3rem] blur-2xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
            <div className="relative w-48 h-48 lg:w-56 lg:h-56 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
              <img src={CV_DATA.imageUrl} alt={CV_DATA.name} className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="flex-1 text-center lg:text-left space-y-4">
            <h1 className="text-5xl lg:text-7xl font-display font-black tracking-tight text-slate-900 leading-none">
              {CV_DATA.name}
            </h1>
            <p className="text-xl lg:text-2xl text-purple-600 font-display font-medium max-w-2xl">
              {CV_DATA.title} <span className="text-slate-300 mx-2">|</span> <span className="text-slate-500">Transforming Enterprise with Intelligent Systems</span>
            </p>
            <div className="flex flex-wrap gap-6 justify-center lg:justify-start text-sm text-slate-400 font-bold uppercase tracking-widest pt-4">
              <a href={`mailto:${CV_DATA.email}`} className="flex items-center gap-2 hover:text-purple-600 transition-colors"><Mail size={16} /> Contact</a>
              <span className="flex items-center gap-2"><Globe size={16} /> {CV_DATA.location}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Road Tab Navigation */}
        <div className="flex flex-wrap gap-3 mb-12 p-2 glass rounded-3xl w-fit mx-auto lg:mx-0">
          <button 
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-display font-bold transition-all relative ${activeTab === 'ai' ? 'bg-white text-purple-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Sparkles size={18} /> AI Innovation
            {activeTab === 'ai' && <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full animate-ping" />}
          </button>
          <button 
            onClick={() => setActiveTab('ms')}
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-display font-bold transition-all relative ${activeTab === 'ms' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Building2 size={18} /> Morgan Stanley Journey
          </button>
          <button 
            onClick={() => setActiveTab('other')}
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-display font-bold transition-all relative ${activeTab === 'other' ? 'bg-white text-slate-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <History size={18} /> Foundations
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Panel with Road Visual */}
          <div className="lg:col-span-8 relative">
            {/* The "Road" Line */}
            <div className="absolute left-[30px] top-10 bottom-10 w-1 bg-slate-100 rounded-full hidden md:block">
              <div className={`absolute top-0 bottom-0 w-full rounded-full transition-all duration-1000 origin-top ${activeTab === 'ai' ? 'bg-purple-300' : activeTab === 'ms' ? 'bg-blue-300' : 'bg-slate-300'}`} />
            </div>

            <div className="space-y-12">
              {activeTab === 'ai' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-10">
                  <div className="glass rounded-[2.5rem] p-8 md:p-10 border-l-8 border-purple-400 ml-0 md:ml-16">
                    <h2 className="text-3xl font-display font-black mb-6 flex items-center gap-3">
                      <Brain className="text-purple-500" /> AI Strategy Roadmap
                    </h2>
                    <p className="text-lg text-slate-600 leading-relaxed italic border-l-2 border-slate-100 pl-6">
                      Leading the convergence of high-finance complexity and generative intelligence.
                    </p>
                  </div>
                  {aiExperiences.map((exp, i) => <ExperienceRoadCard key={exp.id} exp={exp} color="purple" index={i} />)}
                </div>
              )}

              {activeTab === 'ms' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-10">
                  {msExperiences.map((exp, i) => <ExperienceRoadCard key={exp.id} exp={exp} color="blue" index={i} />)}
                </div>
              )}

              {activeTab === 'other' && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-10">
                   <div className="glass rounded-[2.5rem] p-10 bg-pastel-sage/20 border-l-8 border-slate-400 ml-0 md:ml-16">
                    <h2 className="text-3xl font-display font-black mb-6">Academic Background</h2>
                    <div className="grid grid-cols-1 gap-4">
                       {CV_DATA.education.map((edu, i) => (
                         <div key={i} className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center gap-6">
                           <div className="p-4 bg-pastel-purple rounded-2xl text-purple-600"><Award /></div>
                           <div>
                             <p className="font-black text-slate-800 text-lg">{edu.school}</p>
                             <p className="text-sm text-purple-600 font-bold">{edu.degree}</p>
                             <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">{edu.period}</p>
                           </div>
                         </div>
                       ))}
                    </div>
                  </div>
                  {otherExperiences.map((exp, i) => <ExperienceRoadCard key={exp.id} exp={exp} color="slate" index={i} />)}
                </div>
              )}
            </div>
          </div>

          {/* Side Info Panel */}
          <div className="lg:col-span-4 space-y-8">
             <div className="glass rounded-[2.5rem] p-8 space-y-10 sticky top-12">
                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 mb-8">Intelligence Stack</h3>
                  <div className="space-y-8">
                    {CV_DATA.skillCategories.map(cat => (
                      <div key={cat.name} className="space-y-3">
                        <div className="flex items-center gap-2">
                           <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'ai' ? 'bg-purple-400' : 'bg-blue-400'}`} />
                           <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{cat.name}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {cat.items.map(s => (
                            <span key={s} className="px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-slate-500 border border-slate-100 shadow-sm hover:scale-105 transition-transform cursor-default">{s}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                
                <section className="pt-8 border-t border-slate-100">
                   <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/20 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-1000" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Core Philosophy</p>
                      <p className="text-sm font-medium leading-relaxed italic opacity-80 relative z-10">"Solving complex challenges and creating value for clients are my primary missions."</p>
                   </div>
                </section>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExperienceRoadCard = ({ exp, color, index }: { exp: any, color: string, index: number }) => {
  const nodeColors: any = {
    purple: 'bg-purple-500 ring-purple-100 group-hover:bg-purple-600 group-hover:ring-purple-200 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]',
    blue: 'bg-blue-500 ring-blue-100 group-hover:bg-blue-600 group-hover:ring-blue-200 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]',
    slate: 'bg-slate-500 ring-slate-100 group-hover:bg-slate-600 group-hover:ring-slate-200'
  };
  
  return (
    <div className="relative ml-0 md:ml-16 group animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
      {/* Visual Node */}
      <div className={`absolute -left-[42px] top-10 w-6 h-6 rounded-full ring-8 z-20 hidden md:block transition-all duration-500 group-hover:scale-150 ${nodeColors[color]}`} />
      
      <div className={`glass rounded-[2.5rem] p-8 md:p-10 transition-all duration-500 border-2 border-white hover:border-slate-100 shadow-sm hover:shadow-xl`}>
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-2xl font-black text-slate-900 group-hover:text-purple-600 transition-colors">{exp.role}</h3>
              {exp.isCurrent && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-lg">Live</span>}
            </div>
            <p className="font-bold text-slate-400 flex items-center gap-2 uppercase tracking-widest text-[10px]">
              {exp.company} <span className="w-1 h-1 bg-slate-200 rounded-full" /> {exp.location}
            </p>
          </div>
          <span className="px-4 py-2 bg-slate-50 rounded-2xl text-[10px] font-black text-slate-400 tracking-widest border border-slate-100 uppercase">
            {exp.period}
          </span>
        </div>
        <ul className="space-y-4 mb-8">
          {exp.description.map((d: string, i: number) => (
            <li key={i} className="flex gap-4 text-slate-600 leading-relaxed font-medium text-sm group/li">
              <ChevronRight size={16} className={`mt-0.5 shrink-0 transition-transform group-hover/li:translate-x-1 ${color === 'purple' ? 'text-purple-300' : 'text-blue-300'}`} />
              {d}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {exp.skills.map((s: string) => (
            <span key={s} className="px-3 py-1.5 bg-white/50 text-[10px] font-black uppercase tracking-widest text-slate-400 rounded-lg border border-white group-hover:border-purple-200 transition-all">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};