
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { CV_DATA } from '../data';
import { ThemeType } from '../types';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface AIChatProps {
  theme: ThemeType;
}

export const AIChat: React.FC<AIChatProps> = ({ theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: "Hi! I'm Gábor's AI assistant. Ask me anything about his experience!" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', text: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Corrected: Using process.env.API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `
        You are Gábor Béleczki's personal AI Assistant. 
        Gábor Profile: ${CV_DATA.summary}
        Current Role: AI Program Manager at Morgan Stanley.
        Tone: Professional, expert, helpful, and friendly.
        Be concise in your responses.
      `;

      // Corrected: Filter out the initial assistant greeting if it's the first message
      // as Gemini API expects the contents sequence to start with a 'user' role.
      const apiContents = newMessages
        .filter((m, index) => !(index === 0 && m.role === 'assistant'))
        .map(m => ({
          parts: [{ text: m.text }],
          role: m.role === 'user' ? 'user' : 'model'
        }));

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: apiContents,
        config: { systemInstruction, temperature: 0.7 },
      });

      setMessages(prev => [...prev, { role: 'assistant', text: response.text || "Contact Gábor at " + CV_DATA.email }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', text: "Something went wrong. Feel free to email Gábor directly!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = {
    futurist: { bubble: 'bg-purple-600 text-white', window: 'bg-white/90 border-slate-200' },
    executive: { bubble: 'bg-slate-900 text-white', window: 'bg-white/95 border-slate-100' },
    creative: { bubble: 'bg-pastel-peach text-white', window: 'bg-pastel-lavender/90 border-white' },
    structural: { bubble: 'bg-blue-900 text-white', window: 'bg-white border-4 border-blue-950 rounded-none' },
  }[theme];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-28 right-8 z-[60] p-5 rounded-[1.5rem] shadow-2xl transform transition-all duration-300 hover:scale-110 active:scale-95 ${styles.bubble} ${isOpen ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}`}
      >
        <MessageSquare size={28} />
      </button>

      <div className={`fixed bottom-8 right-8 z-[70] w-[90vw] md:w-[420px] h-[600px] rounded-[2.5rem] border shadow-2xl flex flex-col overflow-hidden transition-all duration-500 transform glass ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'} ${theme === 'structural' ? 'rounded-none border-4 border-blue-950' : ''}`}>
        <div className={`p-6 flex items-center justify-between border-b border-white/40 bg-white/20 ${theme === 'structural' ? 'bg-slate-50 border-slate-200' : ''}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${theme === 'structural' ? 'rounded-none' : ''} ${styles.bubble}`}>
              <Bot size={24} />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-800">AI Assistant</h3>
              <p className="text-[10px] opacity-60 font-bold tracking-tighter uppercase">Gábor's Knowledge Engine</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/40 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-white/50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-[1.5rem] text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-blue-950 text-white rounded-br-none' : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'} ${theme === 'structural' ? 'rounded-none border-2 border-blue-950' : ''}`}>
                {m.text}
              </div>
            </div>
          ))}
          {isLoading && <div className="p-4 bg-white/40 w-16 rounded-full flex justify-center gap-1 animate-pulse">
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          </div>}
        </div>

        <div className={`p-6 bg-white/20 border-t border-white/40 ${theme === 'structural' ? 'bg-slate-50 border-slate-200' : ''}`}>
          <div className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about AI projects..."
              className={`w-full py-4 pl-6 pr-14 rounded-2xl border border-white/60 focus:outline-none focus:ring-4 focus:ring-purple-500/10 bg-white/50 text-slate-800 placeholder-slate-400 transition-all font-medium ${theme === 'structural' ? 'rounded-none border-2 border-slate-300 focus:border-blue-700 focus:ring-0' : ''}`}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all ${isLoading || !input.trim() ? 'opacity-30 scale-90' : 'hover:scale-110 active:scale-95'} ${styles.bubble} ${theme === 'structural' ? 'rounded-none' : ''}`}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
