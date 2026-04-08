'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // or a skeleton loader
  }

  const isLight = theme === 'light';

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-background text-foreground h-full">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Ajustes Generales</h1>
          <p className="text-muted-foreground">Administra tus preferencias de la aplicación web.</p>
        </div>

        <div className="border border-border/50 rounded-xl p-6 bg-card">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            Apariencia
          </h2>

          <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${isLight ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {isLight ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-medium text-foreground">Tema Claro</p>
                <p className="text-sm text-muted-foreground">Activa para usar el modo de alto contraste claro.</p>
              </div>
            </div>
            
            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isLight}
              onClick={() => setTheme(isLight ? 'dark' : 'light')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isLight ? 'bg-primary' : 'bg-input'
              }`}
            >
              <span className="sr-only">Usar tema claro</span>
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isLight ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
