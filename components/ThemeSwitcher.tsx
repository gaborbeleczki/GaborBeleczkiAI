
import React from 'react';
import { Palette, Feather, Award, LayoutGrid } from 'lucide-react';
import { ThemeType } from '../types';

interface ThemeSwitcherProps {
  currentTheme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ currentTheme, setTheme }) => {
  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[60] flex items-center glass p-1.5 rounded-3xl shadow-2xl border border-white/40 gap-1.5 ring-1 ring-slate-200 max-w-[95vw] overflow-x-auto no-scrollbar">
      <button
        onClick={() => setTheme('futurist')}
        className={`flex items-center gap-2 px-6 py-3 rounded-[1.25rem] text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 whitespace-nowrap ${
          currentTheme === 'futurist' 
            ? 'bg-white text-slate-900 shadow-lg' 
            : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
        }`}
      >
        <Palette size={14} className="text-pastel-purple" />
        <span className="hidden sm:inline">Soft Tech</span>
      </button>
      
      <button
        onClick={() => setTheme('executive')}
        className={`flex items-center gap-2 px-6 py-3 rounded-[1.25rem] text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 whitespace-nowrap ${
          currentTheme === 'executive' 
            ? 'bg-white text-slate-900 shadow-lg' 
            : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
        }`}
      >
        <Award size={14} className="text-slate-800" />
        <span className="hidden sm:inline">Executive</span>
      </button>

      <button
        onClick={() => setTheme('creative')}
        className={`flex items-center gap-2 px-6 py-3 rounded-[1.25rem] text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 whitespace-nowrap ${
          currentTheme === 'creative' 
            ? 'bg-white text-slate-900 shadow-lg' 
            : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
        }`}
      >
        <Feather size={14} className="text-pastel-peach" />
        <span className="hidden sm:inline">Creative</span>
      </button>

      <button
        onClick={() => setTheme('structural')}
        className={`flex items-center gap-2 px-6 py-3 rounded-[1.25rem] text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 whitespace-nowrap ${
          currentTheme === 'structural' 
            ? 'bg-white text-slate-900 shadow-lg' 
            : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
        }`}
      >
        <LayoutGrid size={14} className="text-blue-900" />
        <span className="hidden sm:inline">Structural</span>
      </button>
    </div>
  );
};
