import React, { useState } from 'react';
import { CV_DATA } from '../../data';
import { Mail, Phone, MapPin, Award, ArrowUpRight, Briefcase, History, Sparkles, User, Target } from 'lucide-react';

export const ExecutiveTheme: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'profile' | 'experience' | 'skills'>('profile');

  const msRoles = CV_DATA.experiences.filter(e => e.company === 'Morgan Stanley');
  const otherRoles = CV_DATA.experiences.filter(e => e.company !== 'Morgan Stanley');

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1a1a1a] font-sans selection:bg-[#E2E8F0] pb-40">
      <div className="h-3 w-full bg-[#334155]"></div>

      <nav className="sticky top-0 z-50 bg-[#FDFCFB]/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-8 flex justify-between items-center h-20">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center text-white font-serif font-bold text-xs">GB</div>
             <span className="font-serif italic font-bold text-xl tracking-tighter">Béleczki.</span>
          </div>
          <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
            <button onClick={() => setActiveSection('profile')} className={`hover:text-slate-900 transition-all py-8 relative ${activeSection === 'profile' ? 'text-slate-900' : ''}`}>
              Executive Brief
              {activeSection === 'profile' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
            </button>
            <button onClick={() => setActiveSection('experience')} className={`hover:text-slate-900 transition-all py-8 relative ${activeSection === 'experience' ? 'text-slate-900' : ''}`}>
              Career Spine
              {activeSection === 'experience' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
            </button>
            <button onClick={() => setActiveSection('skills')} className={`hover:text-slate-900 transition-all py-8 relative ${activeSection === 'skills' ? 'text-slate-900' : ''}`}>
              Asset Inventory
              {activeSection === 'skills' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900" />}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 md:px-16 pt-16">
        
        {activeSection === 'profile' && (
          <div className="animate-in fade-in duration-1000">
            <header className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center mb-32">
              <div className="lg:col-span-8">
                <div className="flex items-center gap-3 text-slate-400 mb-6 font-black text-[10px] uppercase tracking-[0.5em]">
                   <Target size={12} /> Strategic Portfolio
                </div>
                <h1 className="text-7xl md:text-8xl font-serif italic font-medium tracking-tight leading-[0.9] mb-8">
                   The Frontier of <br/>
                  <span className="not-italic font-black text-slate-800 underline decoration-slate-100 underline-offset-8">AI Strategy</span>
                </h1>
                <p className="text-2xl font-light text-slate-500 max-w-xl leading-relaxed mb-12">
                  Driving end-to-end AI automation strategy within global finance hubs. Transforming vision into scalable digital value.
                </p>
                <div className="flex flex-wrap gap-4">
                  <a href={`mailto:${CV_DATA.email}`} className="px-10 py-5 bg-slate-900 text-white rounded-full font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">Open Communication</a>
                  <div className="px-10 py-5 border border-slate-200 rounded-full font-bold text-xs uppercase tracking-widest text-slate-400">Budapest, HU</div>
                </div>
              </div>
              <div className="lg:col-span-4 flex justify-end">
                <div className="w-64 h-80 rounded-[4rem] overflow-hidden grayscale contrast-125 border-[16px] border-white shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-700">
                  <img src={CV_DATA.imageUrl} alt={CV_DATA.name} className="w-full h-full object-cover" />
                </div>
              </div>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-16 border-t border-slate-100 pt-16 mb-24">
               <div className="space-y-6">
                 <div className="w-12 h-12 bg-pastel-blue rounded-2xl flex items-center justify-center text-slate-700 shadow-sm"><Sparkles size={20} /></div>
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Automation Governance</h3>
                 <p className="text-slate-500 font-light leading-relaxed text-sm">Scaling responsible AI frameworks and performance metrics across complex business domains.</p>
               </div>
               <div className="space-y-6">
                 <div className="w-12 h-12 bg-pastel-purple rounded-2xl flex items-center justify-center text-slate-700 shadow-sm"><User size={20} /></div>
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Digital Tooling</h3>
                 <p className="text-slate-500 font-light leading-relaxed text-sm">Orchestrating the global wealth management agenda and internal workflow renovation projects.</p>
               </div>
               <div className="space-y-6">
                 <div className="w-12 h-12 bg-pastel-sage rounded-2xl flex items-center justify-center text-slate-700 shadow-sm"><Briefcase size={20} /></div>
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Asset Management</h3>
                 <p className="text-slate-500 font-light leading-relaxed text-sm">Over 10 years of institutional leadership within Morgan Stanley's global hub operations.</p>
               </div>
            </section>
          </div>
        )}

        {activeSection === 'experience' && (
          <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 space-y-32 pb-24">
            <section className="relative">
              {/* Vertical Spine */}
              <div className="absolute left-[7px] md:left-[147px] top-8 bottom-0 w-px bg-slate-200 hidden md:block" />
              
              <div className="flex items-center gap-6 mb-20">
                <div className="p-5 bg-pastel-blue rounded-[1.5rem] shadow-sm"><Briefcase size={28} /></div>
                <div>
                  <h2 className="text-5xl font-serif font-bold italic">Morgan Stanley Tenure</h2>
                  <p className="text-slate-300 text-[10px] font-black tracking-[0.5em] uppercase mt-1">Global Finance Infrastructure • 2015—Present</p>
                </div>
              </div>
              <div className="space-y-32">
                {msRoles.map((exp, i) => <RoleItem key={exp.id} exp={exp} index={i} />)}
              </div>
            </section>

            <section className="relative">
              <div className="absolute left-[7px] md:left-[147px] top-8 bottom-0 w-px bg-slate-200 hidden md:block" />
              <div className="flex items-center gap-6 mb-20">
                <div className="p-5 bg-pastel-sage rounded-[1.5rem] shadow-sm"><History size={28} /></div>
                <div>
                  <h2 className="text-5xl font-serif font-bold italic">Strategic Foundations</h2>
                  <p className="text-slate-300 text-[10px] font-black tracking-[0.5em] uppercase mt-1">Market Analysis & Academic Growth • 2013—2015</p>
                </div>
              </div>
              <div className="space-y-32">
                {otherRoles.map((exp, i) => <RoleItem key={exp.id} exp={exp} index={i} />)}
              </div>
            </section>
          </div>
        )}

        {activeSection === 'skills' && (
          <div className="animate-in fade-in duration-1000 pb-24">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                <section className="space-y-20">
                   <h2 className="text-7xl font-serif italic font-bold">Strategic <br/> Capability</h2>
                   {CV_DATA.skillCategories.map(cat => (
                     <div key={cat.name} className="space-y-8">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-300 border-b border-slate-100 pb-4">{cat.name}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6">
                           {cat.items.map(s => (
                             <div key={s} className="text-sm font-medium text-slate-600 flex items-center justify-between group hover:translate-x-2 transition-all cursor-default">
                               {s} <ArrowUpRight size={14} className="text-slate-200 group-hover:text-slate-900 transition-colors" />
                             </div>
                           ))}
                        </div>
                     </div>
                   ))}
                </section>
                <section className="space-y-12">
                   <div className="bg-slate-900 text-white p-16 rounded-[4rem] shadow-2xl relative overflow-hidden">
                      <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-slate-800 rounded-full blur-3xl opacity-50" />
                      <Award size={48} className="mb-10 text-slate-500" />
                      <h3 className="text-4xl font-serif italic mb-12">Institutional Record</h3>
                      <div className="space-y-12 relative z-10">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">Education</p>
                          {CV_DATA.education.map((edu, i) => (
                            <div key={i} className="space-y-2">
                              <p className="text-2xl font-bold font-serif leading-none">{edu.school}</p>
                              <p className="text-slate-400 italic text-lg">{edu.degree}</p>
                              <p className="text-xs font-black text-slate-600 tracking-widest uppercase pt-2">{edu.period}</p>
                            </div>
                          ))}
                        </div>
                        <div className="pt-12 border-t border-white/10">
                           <p className="text-slate-400 italic text-xl leading-relaxed">"Translating business vision into tangible client value through optimized digital architectures."</p>
                        </div>
                      </div>
                   </div>
                </section>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

const RoleItem = ({ exp, index }: { exp: any, index: number }) => (
  <div className="grid grid-cols-1 md:grid-cols-12 gap-12 group animate-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: `${index * 150}ms` }}>
    <div className="md:col-span-3 md:text-right relative">
      <div className="md:sticky md:top-32">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2 leading-none">{exp.period}</p>
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-300">{exp.company}</p>
        {exp.role.toLowerCase().includes('ai') && (
          <div className="mt-6 flex md:justify-end">
            <span className="px-3 py-1 bg-pastel-purple rounded-lg text-[10px] font-black uppercase tracking-widest text-purple-700 shadow-sm border border-purple-100">AI Centric</span>
          </div>
        )}
        {/* Connection Node with enhanced hover */}
        <div className={`absolute -right-[34px] top-[14px] w-3 h-3 rounded-full bg-slate-900 border-4 border-[#FDFCFB] z-10 hidden md:block transition-all duration-300 group-hover:scale-175 group-hover:bg-purple-700 group-hover:shadow-[0_0_12px_rgba(107,33,168,0.5)]`} />
      </div>
    </div>
    <div className="md:col-span-9 space-y-8">
       <h3 className="text-4xl font-serif font-bold group-hover:italic transition-all leading-tight text-slate-900">{exp.role}</h3>
       <ul className="space-y-6">
         {exp.description.map((d: string, i: number) => (
           <li key={i} className="text-xl text-slate-500 font-light leading-relaxed border-l-2 border-slate-50 pl-8 group-hover:border-slate-200 transition-all">
             {d}
           </li>
         ))}
       </ul>
       <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-50">
         {exp.skills.map((s: string) => (
           <span key={s} className="text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-900 transition-colors cursor-default"># {s}</span>
         ))}
       </div>
    </div>
  </div>
);