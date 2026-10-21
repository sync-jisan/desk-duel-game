import { Rubik } from 'next/font/google';
import './globals.css';

const rubik = Rubik({
  subsets: ['latin'],
  variable: '--font-rubik',
  display: 'swap',
});

export const metadata = {
  title: 'Desk Duel — Pen Fighting Game',
  description:
    'Shoot your pen, knock other pens off the table, earn coins, and unlock new pens. Play solo, with friends on one phone, or online with friends.',
  applicationName: 'Desk Duel',
  appleWebApp: { capable: true, title: 'Desk Duel', statusBarStyle: 'black-translucent' },
  other: { 'mobile-web-app-capable': 'yes' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#070b16',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={rubik.variable}>
      <body>{children}</body>
    </html>
  );
}
