import React, { useState } from 'react';
import { CV_DATA } from '../../data';
import { Mail, MapPin, Zap, Star, Heart, Sparkles, Building, Rocket, ChevronRight, History } from 'lucide-react';

export const CreativeTheme: React.FC = () => {
  const [view, setView] = useState<'ai' | 'ms' | 'base'>('ai');

  const aiHighlights = CV_DATA.experiences.filter(exp => 
    exp.role.toLowerCase().includes('ai') || exp.description.some(d => d.toLowerCase().includes('ai'))
  );
  const msJourney = CV_DATA.experiences.filter(e => e.company === 'Morgan Stanley');
  const foundational = CV_DATA.experiences.filter(e => e.company !== 'Morgan Stanley');

  return (
    <div className="min-h-screen bg-[#FFFDF7] text-[#423D33] font-sans selection:bg-pastel-yellow selection:text-[#423D33]">
      <div className="flex flex-col lg:flex-row min-h-screen">
        
        {/* Left Side: Creative Identity */}
        <aside className="lg:w-[35%] lg:sticky lg:top-0 h-auto lg:h-screen p-8 lg:p-16 flex flex-col justify-between bg-pastel-lavender/40 border-r border-slate-100">
          <div className="space-y-12">
            <div className="relative w-44 h-44 group mx-auto lg:mx-0">
              <div className="absolute inset-0 bg-pastel-yellow rounded-[4rem] rotate-12 group-hover:rotate-0 transition-transform shadow-xl"></div>
              <img src={CV_DATA.imageUrl} alt={CV_DATA.name} className="relative w-full h-full object-cover rounded-[4rem] border-4 border-white shadow-lg" />
              <div className="absolute -bottom-4 -right-4 bg-white p-3 rounded-2xl shadow-lg border border-slate-50 animate-bounce">
                <Sparkles className="text-pastel-purple" size={24} />
              </div>
            </div>

            <div className="space-y-6 text-center lg:text-left">
              <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-slate-900 leading-[0.85]">
                <span className="text-purple-400">Gábor</span> <br/> Béleczki
              </h1>
              <p className="text-xl font-bold bg-pastel-green px-5 py-2 inline-block -rotate-2 rounded-2xl shadow-sm">
                AI Program Leader
              </p>
            </div>

            <nav className="space-y-4 pt-8 max-w-sm mx-auto lg:mx-0">
               <button 
                onClick={() => setView('ai')}
                className={`w-full text-left p-6 rounded-[2.5rem] border-4 transition-all flex items-center justify-between group ${view === 'ai' ? 'bg-white border-pastel-purple shadow-xl -translate-y-1' : 'bg-transparent border-transparent hover:bg-white/40'}`}
               >
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Roadmap 01</p>
                   <p className="font-black text-2xl">AI Strategy</p>
                 </div>
                 <Sparkles className={view === 'ai' ? 'text-pastel-purple scale-125' : 'text-slate-200'} />
               </button>

               <button 
                onClick={() => setView('ms')}
                className={`w-full text-left p-6 rounded-[2.5rem] border-4 transition-all flex items-center justify-between group ${view === 'ms' ? 'bg-white border-pastel-blue shadow-xl -translate-y-1' : 'bg-transparent border-transparent hover:bg-white/40'}`}
               >
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Roadmap 02</p>
                   <p className="font-black text-2xl">The MS Era</p>
                 </div>
                 <Building className={view === 'ms' ? 'text-pastel-blue scale-125' : 'text-slate-200'} />
               </button>

               <button 
                onClick={() => setView('base')}
                className={`w-full text-left p-6 rounded-[2.5rem] border-4 transition-all flex items-center justify-between group ${view === 'base' ? 'bg-white border-pastel-peach shadow-xl -translate-y-1' : 'bg-transparent border-transparent hover:bg-white/40'}`}
               >
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Roadmap 03</p>
                   <p className="font-black text-2xl">Foundations</p>
                 </div>
                 <Rocket className={view === 'base' ? 'text-pastel-peach scale-125' : 'text-slate-200'} />
               </button>
            </nav>
          </div>

          <div className="mt-12 flex gap-4 lg:gap-6 justify-center lg:justify-start">
            <a href={`mailto:${CV_DATA.email}`} className="p-5 bg-slate-900 text-white rounded-[1.5rem] hover:scale-110 hover:bg-purple-600 transition-all shadow-lg"><Mail size={24} /></a>
            <div className="px-8 py-5 bg-white/60 rounded-[1.5rem] text-center text-[10px] font-black uppercase tracking-widest border border-white flex items-center gap-2">
              <MapPin size={14} /> Budapest
            </div>
          </div>
        </aside>

        {/* Right Side: Animated Road Canvas */}
        <main className="lg:w-[65%] p-8 lg:p-24 overflow-x-hidden min-h-screen relative">
          
          <div className="animate-in fade-in slide-in-from-right-16 duration-1000">
            {view === 'ai' && (
              <div className="space-y-24">
                <header className="space-y-8">
                  <h2 className="text-7xl font-black tracking-tight leading-none text-slate-800">
                    Scaling <span className="text-pastel-purple italic underline decoration-pastel-purple decoration-8 underline-offset-4">Intelligence</span>
                  </h2>
                  <p className="text-3xl text-slate-400 font-medium max-w-2xl leading-relaxed">
                    Driving the convergence of financial infrastructure and generative AI.
                  </p>
                </header>

                <div className="space-y-12 relative border-l-8 border-pastel-purple/10 pl-16">
                   {aiHighlights.map((exp, i) => (
                      <div key={exp.id} className="relative group">
                        {/* Dynamic Roadmap Node for AI */}
                        <div className="absolute -left-[84px] top-8 w-12 h-12 bg-white rounded-full border-8 border-pastel-purple shadow-lg group-hover:scale-125 group-hover:border-purple-500 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-500 z-10 flex items-center justify-center">
                          <Sparkles size={16} className="text-pastel-purple group-hover:text-purple-600 transition-colors" />
                        </div>
                        <CreativeRoadCard exp={exp} theme="purple" index={i} hideIcon />
                      </div>
                   ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="p-14 bg-pastel-purple/20 rounded-[4rem] border-4 border-white shadow-sm hover:shadow-xl transition-all hover:-translate-y-2">
                      <Zap className="text-pastel-purple mb-8" size={56} fill="currentColor" />
                      <h4 className="text-3xl font-black mb-6">Visionary Strategy</h4>
                      <p className="text-lg font-bold text-slate-600 leading-relaxed italic">"Driving end-to-end AI automation strategy, defining vision, and roadmap execution."</p>
                   </div>
                   <div className="p-14 bg-white rounded-[4rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all hover:-translate-y-2">
                      <div>
                        <Star className="text-pastel-yellow mb-8" size={56} fill="currentColor" />
                        <h4 className="text-3xl font-black mb-6">Prime Expertise</h4>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {['Prompt Design', 'AI Literacy', 'Evaluation'].map(s => (
                          <span key={s} className="px-5 py-3 bg-slate-50 rounded-2xl text-xs font-black uppercase tracking-[0.2em]">{s}</span>
                        ))}
                      </div>
                   </div>
                </div>
              </div>
            )}

            {view === 'ms' && (
              <div className="space-y-24">
                <header className="space-y-8">
                   <h2 className="text-7xl font-black tracking-tight text-slate-800">
                     A Decade at <br/> <span className="text-pastel-blue">Morgan Stanley</span>
                   </h2>
                   <p className="text-slate-400 text-2xl font-bold italic">A structured journey of leadership and transformation.</p>
                </header>
                <div className="space-y-12 relative border-l-8 border-pastel-blue/10 pl-16">
                   {msJourney.map((exp, i) => (
                     <div key={exp.id} className="relative group">
                       <div className="absolute -left-[84px] top-8 w-12 h-12 bg-white rounded-full border-8 border-pastel-blue shadow-lg group-hover:scale-125 group-hover:border-blue-400 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-500 z-10 flex items-center justify-center">
                          <Building size={16} className="text-pastel-blue group-hover:text-blue-600 transition-colors" />
                       </div>
                       <CreativeRoadCard exp={exp} theme="blue" index={i} hideIcon />
                     </div>
                   ))}
                </div>
              </div>
            )}

            {view === 'base' && (
              <div className="space-y-24">
                <section className="space-y-16">
                   <h2 className="text-7xl font-black tracking-tight text-slate-800">Foundational <br/><span className="text-pastel-peach">Excellence</span></h2>
                   <div className="space-y-10 relative pl-16 border-l-8 border-pastel-peach/10">
                    {foundational.map((exp, i) => (
                      <div key={exp.id} className="relative group">
                         <div className="absolute -left-[84px] top-8 w-12 h-12 bg-white rounded-full border-8 border-pastel-peach shadow-lg group-hover:scale-125 group-hover:border-orange-400 group-hover:shadow-[0_0_20px_rgba(251,146,60,0.3)] transition-all duration-500 z-10 flex items-center justify-center">
                          {/* Corrected: Explicitly imported History from lucide-react to avoid conflict with global History interface */}
                          <History size={16} className="text-pastel-peach group-hover:text-orange-600 transition-colors" />
                       </div>
                       <CreativeRoadCard exp={exp} theme="peach" index={i} hideIcon />
                      </div>
                    ))}
                   </div>
                </section>
                <section className="bg-white p-16 rounded-[4.5rem] shadow-2xl border border-slate-50 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-48 h-48 bg-pastel-yellow rounded-full blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity" />
                   <h3 className="text-4xl font-black mb-16 flex items-center gap-4">
                     Academic Core <Rocket className="text-pastel-peach" />
                   </h3>
                   {CV_DATA.education.map((edu, i) => (
                     <div key={i} className="flex flex-col md:flex-row justify-between border-t-2 border-slate-50 py-10 first:border-0 group/edu hover:translate-x-4 transition-transform">
                        <div>
                          <p className="text-3xl font-black text-slate-800 group-hover/edu:text-pastel-peach transition-colors">{edu.school}</p>
                          <p className="text-xl text-slate-400 font-bold mt-2">{edu.degree}</p>
                        </div>
                        <p className="text-sm font-black text-slate-200 mt-6 md:mt-0 uppercase tracking-widest">{edu.period}</p>
                     </div>
                   ))}
                </section>
              </div>
            )}
          </div>

          <footer className="mt-48 text-center space-y-10">
             <div className="p-6 bg-pastel-pink/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto hover:scale-110 transition-transform cursor-pointer">
                <Heart className="text-pastel-pink" fill="currentColor" size={36} />
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">Gábor Béleczki • AI Portfolio 2025</p>
          </footer>

        </main>
      </div>
    </div>
  );
};

const CreativeRoadCard = ({ exp, theme, index, hideIcon }: { exp: any, theme: string, index: number, hideIcon?: boolean }) => {
  const styles: any = {
    purple: 'hover:border-pastel-purple bg-white text-slate-800',
    blue: 'hover:border-pastel-blue bg-white text-slate-800',
    peach: 'hover:border-pastel-peach bg-white text-slate-800'
  };

  return (
    <div className={`p-10 md:p-14 rounded-[4rem] border-8 border-transparent transition-all duration-700 group shadow-sm hover:shadow-2xl animate-in slide-in-from-right-8 duration-700 ${styles[theme]}`} style={{ animationDelay: `${index * 150}ms` }}>
      <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 block mb-3">{exp.period}</span>
          <h3 className="text-4xl font-black text-slate-800 leading-none group-hover:scale-[1.02] origin-left transition-transform">{exp.role}</h3>
        </div>
        {!hideIcon && (
          <div className={`p-5 rounded-3xl ${theme === 'purple' ? 'bg-pastel-purple/20 text-purple-600' : 'bg-pastel-peach/20 text-peach-600'}`}>
            <Star fill="currentColor" size={24} />
          </div>
        )}
      </div>
      <ul className="space-y-6 mb-12">
        {exp.description.map((d: string, i: number) => (
          <li key={i} className="text-xl text-slate-500 font-bold leading-relaxed flex gap-5 group/li">
            <ChevronRight size={24} className={`mt-1 shrink-0 transition-transform group-hover/li:translate-x-2 ${theme === 'purple' ? 'text-pastel-purple' : 'text-pastel-blue'}`} />
            {d}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        {exp.skills.map((s: string) => (
          <span key={s} className="px-6 py-2 bg-slate-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-100 transition-all cursor-default">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
};
