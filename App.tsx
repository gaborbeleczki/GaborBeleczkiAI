import React, { useState } from 'react';
import { ThemeType } from './types';
import { StructuralTheme } from './components/themes/StructuralTheme';
import { AIChat } from './components/AIChat';

const App: React.FC = () => {
  const [theme] = useState<ThemeType>('structural');

  return (
    <div className="relative w-full min-h-screen transition-colors duration-500">
      <StructuralTheme />
      <AIChat theme={theme} />
    </div>
  );
};

export default App;