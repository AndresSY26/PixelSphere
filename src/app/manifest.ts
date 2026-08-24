
import { MetadataRoute } from 'next'

/**
 * PROTOCOLO DE MANIFIESTO PWA v2.0 - OPTIMIZADO PARA ESCRITORIO (RICH INSTALL UI)
 * Configuración avanzada para permitir instalación nativa en Windows, macOS y Linux.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PixelSphere | Neural Multimedia Orchestrator',
    short_name: 'PixelSphere',
    description: 'Gestión multimedia con IA profesional, seguridad física y orquestación geoespacial.',
    start_url: '/',
    id: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#0a0a0c',
    theme_color: '#7373F0',
    icons: [
      {
        src: 'https://picsum.photos/seed/pixelsphere-192/192/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: 'https://picsum.photos/seed/pixelsphere-mask/192/192/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'https://picsum.photos/seed/pixelsphere-512/512/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: 'https://picsum.photos/seed/pixelsphere-512-mask/512/512/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['productivity', 'multimedia', 'security', 'photography'],
    screenshots: [
      {
        src: 'https://picsum.photos/seed/ps-desktop-shot/1920/1080',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Dashboard Neural de Escritorio'
      },
      {
        src: 'https://picsum.photos/seed/ps-mobile-shot/750/1334',
        sizes: '750x1334',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Interfaz Móvil PixelSphere'
      }
    ],
    shortcuts: [
      {
        name: 'Abrir Galería',
        url: '/gallery',
        icons: [{ src: 'https://picsum.photos/seed/ps-gal/96/96', sizes: '96x96' }]
      },
      {
        name: 'Cámara Neural',
        url: '/dashboard?action=upload',
        icons: [{ src: 'https://picsum.photos/seed/ps-cam/96/96', sizes: '96x96' }]
      }
    ]
  }
}
