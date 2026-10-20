import {Rubik} from 'next/font/google';
import './globals.css';

const rubik=Rubik({subsets:['latin'],weight:['400','500','600','700','800','900'],style:['normal','italic'],variable:'--font-rubik',display:'swap'});

export const metadata={
  title:'Desk Duel — Pen Fighting Championship',
  description:'Flick your pen, knock rivals off the desk, earn coins and unlock heavier pens. Play solo, with friends on one device, or online.',
  applicationName:'Desk Duel',
  appleWebApp:{capable:true,title:'Desk Duel',statusBarStyle:'black-translucent'},
  other:{'mobile-web-app-capable':'yes'},
};

export const viewport={
  width:'device-width',initialScale:1,maximumScale:1,userScalable:false,viewportFit:'cover',themeColor:'#070b16',
};

export default function RootLayout({children}){
  return (
    <html lang="en" className={rubik.variable}>
      <body>{children}</body>
    </html>
  );
}
