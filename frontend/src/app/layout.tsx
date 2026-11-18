import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { StoreProvider } from '@/components/redesign/store';
import { ServiceWorker } from '@/components/redesign/ServiceWorker';
import { appearanceScript } from '@/lib/appearance';
import './globals.css';
const manrope = localFont({
  src: './fonts/Manrope-Variable.ttf',
  variable: '--font-manrope',
  display: 'swap',
  weight: '400 800',
  style: 'normal',
  fallback: ['Arial', 'sans-serif'],
});
export const metadata: Metadata = { title: 'StepFlow — от первого шага до результата', description: 'Создавай пошаговые инструкции, сохраняй прогресс и помогай другим разобраться с задачей.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ru" className={manrope.variable} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: appearanceScript }} /></head>
    <body><ServiceWorker /><StoreProvider>{children}</StoreProvider></body>
  </html>;
}
