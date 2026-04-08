'use client';
// ─── features/providers/providers.tsx ────────────────────────────────────────
// Client-side provider tree. Extracted from the Server Component layout so
// that layout.tsx remains a Server Component.
// Provides: AuthProvider, QueryClientProvider

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/features/auth/auth-provider';
import { useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per browser session (not singleton to avoid SSR cross-contamination)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
