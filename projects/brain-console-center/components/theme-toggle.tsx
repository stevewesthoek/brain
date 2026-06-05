'use client';

import { Moon, Sun, Laptop2 } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useState, useEffect } from 'react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="theme-toggle">
      <button
        onClick={() => setTheme('light')}
        className={theme === 'light' ? 'active' : ''}
        title="Light mode"
        aria-label="Light mode"
      >
        <Sun size={16} />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={theme === 'dark' ? 'active' : ''}
        title="Dark mode"
        aria-label="Dark mode"
      >
        <Moon size={16} />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={theme === 'system' ? 'active' : ''}
        title="System preference"
        aria-label="System preference"
      >
        <Laptop2 size={16} />
      </button>
    </div>
  );
}
