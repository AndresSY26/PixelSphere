<div align="center">

# 🌐 PixelSphere
### *Plataforma Multimedia Inteligente con Orquestación Neural, IA Generativa y Bóveda Segura*

[![Next.js](https://img.shields.io/badge/Next.js-15.5.9-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.1-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.1-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Google Genkit](https://img.shields.io/badge/Genkit-Google%20GenAI-orange?style=for-the-badge&logo=google)](https://firebase.google.com/docs/genkit)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-green?style=for-the-badge&logo=pwa)](https://developer.mozilla.org/es/docs/Web/Progressive_web_apps)

</div>

---

## 📖 Descripción General

**PixelSphere** es una aplicación web progresiva (PWA) de alto rendimiento diseñada para la gestión, procesamiento y visualización inteligente de contenido multimedia. Integra modelos avanzados de Inteligencia Artificial de Google (a través de **Genkit** y **Gemini**), streaming de video de baja latencia con soporte HTTP Range, una bóveda encriptada con algoritmo AES-256 para archivos confidenciales y sincronización en tiempo real vía Server-Sent Events (SSE).

Diseñada originalmente en Firebase Studio y adaptada a Google AI Studio, la plataforma cuenta con una arquitectura desacoplada, escalable y optimizada para despliegues autónomos (`standalone`).

---

## 🚀 Características Principales

### 🧠 Inteligencia Artificial Multimodal (Google Gemini + Genkit)
- **Auto-etiquetado Semántico:** Clasificación y generación automatizada de etiquetas, títulos y metadatos descriptivos a partir del contenido visual de las imágenes.
- **Editor Generativo de Imágenes:** Herramienta interactiva para transformar o retocar imágenes mediante instrucciones en lenguaje natural impulsadas por IA.

### 🔒 Bóveda de Seguridad & Cifrado (AES-256)
- **Cifrado Simétrico Fuerte:** Cifrado de archivos sensibles y álbumes privados mediante AES-256-CBC con vectores de inicialización (IV) dinámicos.
- **Autenticación Biométrica & 2FA:** Compatibilidad con WebAuthn / FIDO2 y códigos de verificación basados en tiempo (TOTP) gestionados con `otplib`.

### ⚡ Rendimiento & Multimedia Avanzada
- **Streaming de Video Neural con HTTP Range:** Reproducción fluida y segmentada de video de alta resolución sin sobrecargar la memoria del cliente ni del servidor.
- **Mapa Geoespacial Interactivo:** Georreferenciación de fotografías y videos mediante mapas Leaflet y OpenStreetMap con agrupación visual por coordenadas.
- **Nexo Neural (SSE):** Canal de comunicación unidireccional persistente vía Server-Sent Events (`/api/neural-stream`) para transmitir cambios de estado y sincronización reactiva en tiempo real.

### 📱 Experiencia de Usuario & PWA
- **Instalable en Escritorio y Móviles:** Service Worker dedicado (`sw.js`) con políticas de cache y manifiesto PWA que permite su instalación nativa.
- **Interfaz Moderna con ShadCN & Radix UI:** Componentes accesibles, fluidos y con diseño responsivo basado en paleta oscura profesional.
- **Sistema de Logros y Gamificación:** Insignias y métricas de avance según la actividad y utilización de herramientas dentro del sistema.

---

## 🏗️ Arquitectura y Estructura del Proyecto

El proyecto está estructurado modularmente para maximizar la separación de responsabilidades y permitir un crecimiento escalable:

```plaintext
PixelSphere/
├── data/                    # Persistencia atómica local en archivos JSON estructurados
├── public/
│   ├── sw.js                # Service Worker para capacidades PWA y caché offline
│   └── uploads/             # Directorio de almacenamiento de medios físicos
├── src/
│   ├── ai/                  # Núcleo de IA con Google Genkit
│   │   ├── dev.ts           # Servidor local de desarrollo para Genkit
│   │   ├── genkit.ts        # Inicialización del SDK y configuración del modelo Gemini
│   │   └── flows/           # Flujos ejecutables (auto-tagging, generative editor)
│   ├── app/                 # Next.js 15 App Router (Páginas y Rutas de API)
│   │   ├── (vistas)/        # Rutas de navegación: /gallery, /vault, /world, /editor, etc.
│   │   ├── api/             # Endpoints backend (/api/upload, /api/neural-stream, /api/cloud)
│   │   ├── globals.css      # Variables de diseño y estilos globales de Tailwind
│   │   └── layout.tsx       # Root layout con proveedores de tema y notificaciones
│   ├── components/          # Componentes de interfaz de usuario
│   │   ├── ui/              # Componentes base ShadCN / Radix (dialogs, cards, buttons)
│   │   ├── album-browser.tsx
│   │   ├── dashboard-layout.tsx
│   │   ├── media-card.tsx
│   │   ├── neural-video-player.tsx
│   │   ├── pwa-installer.tsx
│   │   ├── upload-dialog.tsx
│   │   └── world-map.tsx
│   ├── hooks/               # Custom hooks de React (use-neural-sync, use-toast, use-mobile)
│   └── lib/                 # Lógica de dominio y utilidades
│       ├── neural-events.ts # Emisor centralizado de eventos SSE
│       ├── storage-core.ts  # Motor de persistencia en disco, cifrado AES y seguridad
│       ├── storage.ts       # Capa de abstracción de datos para el cliente y servidor
│       ├── types.ts         # Definiciones TypeScript de entidades y contratos
│       └── utils.ts         # Funciones utilitarias generales
├── components.json          # Configuración del CLI de ShadCN UI
├── next.config.ts           # Configuración de Next.js (Standalone, dominios de imagen, etc.)
├── package.json             # Dependencias del proyecto y scripts de ejecución
├── tailwind.config.ts       # Configuración de diseño atómico con Tailwind CSS
└── tsconfig.json            # Configuración estricta del compilador TypeScript
```

---

## 🛠️ Requisitos Previos

- **Node.js**: Versión 18.18.0 o superior (recomendado Node.js 20 LTS o superior).
- **Gestor de paquetes**: `npm`, `pnpm` o `yarn`.
- **Clave de API de Gemini**: Obtenible de manera gratuita en [Google AI Studio](https://aistudio.google.com/).

---

## ⚙️ Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/AndresSY26/PixelSphere.git
   cd PixelSphere
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar las variables de entorno:**
   Crea un archivo `.env` en la raíz del proyecto tomando como referencia `.env.example`:
   ```bash
   cp .env.example .env
   ```

   Edita el archivo `.env` e ingresa tu clave de Google Gemini:
   ```env
   GOOGLE_GENAI_API_KEY=tu_clave_de_api_aqui
   ```

---

## 💻 Scripts Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo en el puerto 3000 (`http://localhost:3000`). |
| `npm run build` | Compila la aplicación y genera la salida optimizada `standalone`. |
| `npm run start` | Inicia la aplicación en modo de producción sobre los artefactos compilados. |
| `npm run typecheck` | Ejecuta la verificación estricta de tipos de TypeScript (`tsc --noEmit`). |
| `npm run lint` | Ejecuta el análisis de código con ESLint. |
| `npm run genkit:dev` | Inicia la interfaz de inspección y depuración de flujos de Genkit en local. |

---

## 🚢 Despliegue en Producción (Modo Standalone & Docker)

El archivo `next.config.ts` incluye la instrucción:
```typescript
output: "standalone"
```
Al ejecutar `npm run build`, Next.js empaqueta automáticamente el servidor y sus dependencias mínimas en `.next/standalone`, lo que permite crear imágenes Docker de tamaño ultra reducido o ejecutar directamente en cualquier servidor:
```bash
node .next/standalone/server.js
```

---

## 🔒 Manejo Seguro de Errores y Registro

Todas las operaciones críticas (persistencia atómica en disco, deserialización de datos, autenticación biométrica, streaming HTTP Range y subidas multimedia) incorporan control estructurado de excepciones con registro trazable mediante `console.error`, garantizando visibilidad total durante la monitorización y depuración en entornos de producción.

---

## 📄 Licencia

Este proyecto está bajo la licencia privada y de desarrollo de su autor. Todos los derechos reservados.

Desarrollado y mantenido por [@AndresSY26](https://github.com/AndresSY26).