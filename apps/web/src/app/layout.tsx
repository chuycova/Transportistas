// ─── app/layout.tsx ───────────────────────────────────────────────────────────
// Root layout — Server Component.
// Wraps the entire app with providers that need to exist at the root.
// All client-only providers are in <Providers /> to keep this file a SC.

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from '@/features/providers/providers';
import '../index.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'ZonaZero — Portal de Monitoreo',
  description: 'Dashboard de monitoreo de flotilla vehicular en tiempo real.',
  robots: { index: false, follow: false }, // Internal admin tool — never index
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
