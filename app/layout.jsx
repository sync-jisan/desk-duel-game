export const metadata = {
  title: 'Desk Duel — Pen Fighting Championship',
  description: 'Real-time physics pen fighting championship with Google authentication, cloud save, and online multiplayer.',
  keywords: ['pen fighting', 'game', 'multiplayer', 'physics game', 'desk duel'],
  authors: [{ name: 'Desk Duel Team' }],
  openGraph: {
    title: 'Desk Duel — Pen Fighting Championship',
    description: 'Flick your pen, knock rivals off the desk, and become the champion. Real-time multiplayer powered by Supabase.',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#050913',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,400..900;1,400..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#050913', color: '#fff' }}>
        {children}
      </body>
    </html>
  );
}
