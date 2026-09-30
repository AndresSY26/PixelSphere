
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import PWAInstaller from '@/components/pwa-installer';

export const metadata: Metadata = {
  title: 'PixelSphere | Gestión Multimedia con IA Profesional',
  description: 'La plataforma definitiva para organizar, editar y proteger tu contenido multimedia con inteligencia artificial avanzada.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PixelSphere',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#1a1a1f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="https://picsum.photos/seed/pixelsphere/512/512" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(reg) { console.log('Service Service registrado:', reg.scope); },
                    function(err) { console.error('Fallo en registro de SW:', err); }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen">
        {children}
        <Toaster />
        <PWAInstaller />
      </body>
    </html>
  );
}
