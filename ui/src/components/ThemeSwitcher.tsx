import { useState } from 'react';
import { Palette, Sparkles, Layers, Rainbow } from 'lucide-react';
import '../themes/cyberpunk.css';
import '../themes/glassmorphic.css';
import '../themes/gradient.css';

const themes = [
  { 
    id: 'default', 
    name: 'Default Dark', 
    icon: Palette,
    preview: 'bg-gray-800'
  },
  { 
    id: 'cyberpunk', 
    name: 'Cyberpunk', 
    icon: Sparkles,
    preview: 'bg-purple-600'
  },
  { 
    id: 'glass', 
    name: 'Glassmorphic', 
    icon: Layers,
    preview: 'bg-white/10'
  },
  { 
    id: 'gradient', 
    name: 'Gradient', 
    icon: Rainbow,
    preview: 'bg-gradient-to-r from-blue-500 to-purple-600'
  }
];

export function ThemeSwitcher() {
  const [activeTheme, setActiveTheme] = useState('default');
  const [isOpen, setIsOpen] = useState(false);

  const applyTheme = (themeId: string) => {
    // Remove all theme classes
    document.body.classList.remove('theme-cyberpunk', 'theme-glass', 'theme-gradient');
    
    // Apply new theme
    if (themeId !== 'default') {
      document.body.classList.add(`theme-${themeId}`);
    }
    
    setActiveTheme(themeId);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Theme Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-800 p-3 rounded-full shadow-lg hover:bg-gray-700 transition-all transform hover:scale-110"
      >
        <Palette className="h-6 w-6" />
      </button>

      {/* Theme Options */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-gray-800 rounded-lg shadow-xl p-4 w-64 animate-fade-in">
          <h3 className="text-sm font-semibold mb-3">Choose Theme</h3>
          <div className="space-y-2">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => applyTheme(theme.id)}
                className={`
                  w-full flex items-center space-x-3 p-3 rounded-lg transition-all
                  ${activeTheme === theme.id 
                    ? 'bg-blue-600/20 border border-blue-500' 
                    : 'hover:bg-gray-700'
                  }
                `}
              >
                <div className={`w-8 h-8 rounded ${theme.preview}`} />
                <div className="flex-1 text-left">
                  <div className="flex items-center space-x-2">
                    <theme.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{theme.name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}