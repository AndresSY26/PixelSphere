<div align="center">

# 🌐 PixelSphere
### *Plataforma Multimedia Inteligente de Próxima Generación con IA Generativa, Bóveda Cifrada y Google Pay*

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech/)
[![Firebase Storage](https://img.shields.io/badge/Firebase_Storage-Zero--Disk-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Google Pay](https://img.shields.io/badge/Google_Pay-Integrated-4285F4?style=for-the-badge&logo=google-pay&logoColor=white)](https://pay.google.com/)
[![Google Gemini AI](https://img.shields.io/badge/Gemini_AI-2.5_Flash-8E75C2?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

</div>

---

## 📖 Descripción General

**PixelSphere** es una plataforma de gestión multimedia moderna, escalable y segura diseñada para almacenar, organizar, editar y analizar fotografías y videos de alta resolución con inteligencia artificial generativa.

### ✨ Pilares de la Arquitectura

1. **Persistencia en la Nube con PostgreSQL (Neon):**
   - Base de datos relacional PostgreSQL de alto rendimiento alojada en la nube (Neon Cloud Serverless).
   - Control de concurrencia, índices optimizados y modelos relacionales estructurados: usuarios, medios, álbumes, logros, historial y transacciones de pagos.
   - Cero dependencia de archivos `.json` locales para almacenamiento persistente.

2. **Almacenamiento Zero-Disk con Cifrado en la Nube (Firebase Storage):**
   - Arquitectura **Zero Server-Disk Storage**: el servidor Node.js no almacena archivos de medios en disco físico persistente.
   - Cifrado **Zero-Knowledge (AES-256-GCM)** para archivos en tránsito y en reposo.
   - Entrega y streaming multimedia en memoria a través del proxy `/uploads` con soporte HTTP 206 (Range requests) para video 4K fluido.

3. **Pasarela de Pago Integrada con Google Pay:**
   - Soporte nativo para **Google Pay Web API** con tokenización segura de tarjetas y credenciales de pago.
   - Flujo de actualización de planes (`Free`, `Pro`, `Enterprise`) con emisión de recibos y registro auditable en la tabla relacional `payments`.
   - Facturación mensual y anual con cálculo dinámico de cuotas de almacenamiento y capacidades de IA.

4. **Inteligencia Artificial Multimodal con Google Gemini:**
   - Auto-etiquetado semántico de imágenes y videos usando la versión más reciente del SDK `@google/genai`.
   - Extracción de metadatos profundos: categorización de contenido, paleta de colores dominantes, análisis de composición y detección de escenas.
   - Editor generativo con prompts para enriquecimiento visual.

5. **Seguridad y Privacidad Avanzada:**
   - Bóveda privada (Vault) protegida por contraseña maestra independiente.
   - Autenticación multifactor **2FA (TOTP)** con generación de códigos QR compatibles con Google Authenticator y Authy.
   - Hashing criptográfico SHA-512 con salt dinámico para credenciales de acceso.

6. **Reactividad en Tiempo Real y PWA:**
   - Sincronización multi-dispositivo instantánea mediante canal **Server-Sent Events (SSE)** en `/api/neural-stream`.
   - Progressive Web App (PWA) instalable en escritorio y dispositivos móviles con Service Worker y soporte offline.
   - Integración nativa con Google Drive para importación directa de galerías a la bóveda.

---

## 🏗️ Estructura del Proyecto

```plaintext
PixelSphere/
├── server.ts                          # Servidor principal Full-Stack (Express + Proxy de Nube + Compresión GZIP)
├── package.json                       # Orquestador del monorepo y dependencias compartidas
├── metadata.json                      # Metadatos del applet y capacidades del sistema
├── .env.example                       # Plantilla de variables de entorno (Neon PostgreSQL, puertos)
├── firebase-applet-config.json        # Configuración de Firebase Cloud Storage y Auth
│
├── backend/                           # API REST y Servicios de Backend (Node.js ESM)
│   ├── package.json                   # Dependencias de backend (@google/genai, pg, otplib, multer, sharp)
│   ├── server.js                      # Punto de entrada alternativo para backend independiente
│   └── src/
│       ├── config/
│       │   └── constants.js           # Constantes globales, claves criptográficas y directorios efímeros
│       ├── db/
│       │   └── index.js               # Conexión a Neon PostgreSQL, pool pg, DDL y esquemas relacionales
│       ├── controllers/
│       │   ├── authController.js      # Registro, Login, 2FA TOTP, perfil y planes
│       │   ├── mediaController.js     # Ingesta multimedia, subida por chunks, streaming HTTP 206 y papelera
│       │   ├── albumController.js     # Álbumes, jerarquías de carpetas y asignación de portadas
│       │   ├── aiController.js        # Auto-etiquetado y transformaciones con Google Gemini
│       │   ├── paymentController.js   # Pasarela Google Pay, tokenización y registro de transacciones
│       │   ├── streamController.js    # Conexión SSE (/api/neural-stream) para reactividad en vivo
│       │   ├── cloudController.js     # Proxy e importación directa desde Google Drive
│       │   └── statsController.js     # Métricas administrativas, historial de vistas y logros
│       ├── middlewares/
│       │   ├── uploadMiddleware.js    # Multer en memoria (MemoryStorage) para fragmentos y archivos
│       │   └── errorHandler.js        # Middleware centralizado de gestión de errores HTTP
│       ├── routes/
│       │   ├── index.js               # Enrutador principal montado en /api
│       │   ├── authRoutes.js          # Rutas /api/auth/*
│       │   ├── mediaRoutes.js         # Rutas /api/media/*
│       │   ├── albumRoutes.js         # Rutas /api/albums/*
│       │   ├── aiRoutes.js            # Rutas /api/ai/*
│       │   └── paymentRoutes.js       # Rutas /api/payments/* (Google Pay & Historial)
│       └── services/
│           ├── storageService.js      # Capa de acceso a datos PostgreSQL y sincronización de caché en RAM
│           ├── cloudStorageService.js # Interfaz directa con Firebase Cloud Storage (Buffer I/O)
│           ├── mediaOptimizationService.js # Compresión Sharp, WebP, thumbnails y cifrado AES-256-GCM
│           ├── cryptoService.js       # Cifrado simétrico de bóveda, SHA-512 y tokens TOTP
│           ├── eventService.js        # Emisión de eventos SSE para todos los clientes activos
│           └── geminiService.js       # Conexión con Google Gemini AI mediante @google/genai
│
├── frontend/                          # Cliente Web SPA (Vite + React 19 + Tailwind CSS)
│   ├── index.html                     # Entrada HTML5 con meta tags PWA, OpenGraph y Leaflet CSS
│   ├── vite.config.js                 # Configuración de empaquetado Vite, alias de shims y proxy /api
│   ├── tailwind.config.js             # Diseño responsivo, paleta oscura neón y animaciones
│   ├── public/
│   │   ├── manifest.json              # Manifiesto de PWA instalable
│   │   └── sw.js                      # Service Worker para caché inteligente y offline
│   └── src/
│       ├── main.jsx                   # Renderizado de React en el DOM
│       ├── App.jsx                    # Enrutamiento principal (React Router v6)
│       ├── api/
│       │   └── client.js              # Cliente HTTP centralizado para el backend REST
│       ├── components/
│       │   ├── google-pay-checkout-dialog.tsx # Diálogo de pasarela y procesamiento de Google Pay
│       │   ├── upgrade-plan-dialog.tsx        # Selección de suscripciones y planes (Pro / Enterprise)
│       │   ├── upload-dialog.tsx              # Subida de archivos por lotes o fragmentada con IA
│       │   ├── media-card.tsx                 # Tarjetas multimedia con vista previa, menú y tags
│       │   ├── neural-video-player.tsx        # Reproductor de video HLS / MP4 con buffer progresivo
│       │   ├── world-map.tsx                  # Mapa interactivo con Leaflet y agrupación geográfica
│       │   ├── google-drive-picker.tsx        # Selector de archivos de Google Drive
│       │   ├── pwa-installer.tsx              # Banner de instalación como app nativa
│       │   └── ui/                            # Biblioteca de componentes UI basados en Radix Primitives
│       ├── pages/
│       │   ├── gallery.tsx            # Galería principal con filtros, búsqueda y vista en cuadrícula
│       │   ├── vault.tsx              # Bóveda privada protegida por PIN y cifrado Zero-Knowledge
│       │   ├── albums.tsx             # Explorador y creador de álbumes fotográficos
│       │   ├── editor.tsx             # Editor fotográfico con retoques y filtros de Gemini AI
│       │   ├── world.tsx              # Visualización geoespacial de capturas en mapa mundial
│       │   ├── timeline.tsx           # Vista cronológica de capturas por año, mes y día
│       │   ├── settings.tsx           # Configuración de cuenta, 2FA, almacenamiento y pagos
│       │   ├── trash.tsx              # Papelera de reciclaje con purga automática a los 30 días
│       │   ├── bridge.tsx             # Puente de sincronización en la nube (Google Drive / Photos)
│       │   ├── achievements.tsx       # Gamificación y medallas de uso de la plataforma
│       │   └── admin.tsx              # Panel de métricas y estadísticas del sistema
│       ├── lib/
│       │   ├── google-pay.ts          # Integración cliente de Google Pay API
│       │   ├── storage.ts             # Adaptador de almacenamiento y sincronización de sesión
│       │   ├── utils.ts               # Utilidades de Tailwind y formateadores de bytes/fechas
│       │   └── types.ts               # Definiciones de tipos TypeScript compartidos
│       └── hooks/
│           ├── use-neural-sync.ts     # Hook para suscribirse al stream de eventos SSE en tiempo real
│           └── use-toast.ts           # Notificaciones tipo toast en UI
```

---

## 🗄️ Esquema de la Base de Datos (PostgreSQL)

La persistencia de datos se gestiona en **Neon PostgreSQL**, con inicialización automática de esquemas e índices en el arranque:

| Tabla | Columnas Clave | Propósito |
| :--- | :--- | :--- |
| `users` | `id`, `email`, `password_hash`, `name`, `role`, `two_factor_secret`, `two_factor_enabled`, `plan`, `storage_limit_bytes` | Cuentas de usuario, credenciales, estado 2FA y planes de suscripción. |
| `media` | `id`, `user_id`, `filename`, `type`, `url`, `thumbnail_url`, `cloud_storage_path`, `cloud_url`, `size`, `is_private`, `is_favorite`, `is_trash`, `tags`, `metadata` | Archivos de fotos y videos, referencias de Cloud Storage, tags IA y coordenadas GPS. |
| `albums` | `id`, `user_id`, `title`, `description`, `parent_id`, `cover_media_id`, `media_ids`, `is_public` | Agrupación jerárquica de álbumes y asignación de imágenes. |
| `payments` | `id`, `user_id`, `plan`, `billing_cycle`, `amount_usd`, `currency`, `payment_method`, `transaction_reference`, `card_last4`, `status`, `created_at` | Registro auditable de pagos procesados mediante Google Pay. |
| `achievements`| `id`, `user_id`, `badge_id`, `unlocked_at` | Sistema de logros y recompensas por actividad en la plataforma. |
| `view_history`| `id`, `user_id`, `media_id`, `viewed_at` | Registro cronológico de visualizaciones multimedia por usuario. |

---

## 💳 Pasarela de Pago: Google Pay

PixelSphere incluye soporte completo para **Google Pay**:

### 1. Flujo de Transacción
1. **Configuración Pública (`GET /api/payments/config/google-pay`):**
   - El cliente solicita los parámetros de pasarela (Merchant ID, Allowed Auth Methods, Card Networks).
2. **Autorización en Cliente:**
   - Se despliega el botón nativo de Google Pay (`google-pay-checkout-dialog.tsx`).
   - El usuario autoriza el pago con sus tarjetas vinculadas en su cuenta de Google.
3. **Procesamiento en Servidor (`POST /api/payments/google-pay/process`):**
   - El backend valida el token o datos de la transacción, genera una referencia única (`pay_...`).
   - Actualiza automáticamente el plan del usuario (`users.plan` a `pro` o `enterprise`) y amplía su cuota de almacenamiento a 100GB o 1TB.
   - Registra el recibo en la tabla PostgreSQL `payments`.
4. **Historial de Pagos (`GET /api/payments/history/:userId`):**
   - Visualizable de inmediato en la sección de **Configuración > Suscripción y Facturación**.

---

## 📡 Referencia de la API REST (`/api`)

### Autenticación y Cuentas
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Registro de nuevos usuarios con hash SHA-512 |
| `POST` | `/api/auth/login` | Inicio de sesión con verificación de contraseña y soporte 2FA |
| `POST` | `/api/auth/2fa/setup` | Genera secreto TOTP y código QR para autenticador |
| `POST` | `/api/auth/2fa/confirm` | Valida código de 6 dígitos y activa 2FA en PostgreSQL |
| `POST` | `/api/auth/2fa/disable` | Desactiva 2FA previa validación |
| `GET` | `/api/auth/profile/:id` | Obtiene información del perfil de usuario y estadísticas |
| `PUT` | `/api/auth/profile/:id` | Actualiza nombre, avatar y preferencias de usuario |

### Medios y Streaming
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/media` | Lista medios filtrados por tipo, álbum, privados, favoritos o papelera |
| `POST` | `/api/media/upload` | Subida directa de imágenes/videos con optimización Sharp y auto-etiquetado |
| `POST` | `/api/upload` | Ingesta de archivos pesados en fragmentos (chunked uploads) |
| `GET` | `/api/media/:id` | Detalle completo de un medio y metadatos EXIF / GPS |
| `PUT` | `/api/media/:id` | Modifica título, etiquetas o estado de privacidad/favorito |
| `DELETE`| `/api/media/:id` | Envía a papelera o purga permanentemente de PostgreSQL y Cloud Storage |
| `GET` | `/uploads/*` | Entrega segura en memoria desde Firebase Storage con streaming HTTP 206 |

### Álbumes
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/albums` | Lista álbumes del usuario con conteo de elementos |
| `POST` | `/api/albums` | Crea un nuevo álbum con descripción y privacidad |
| `PUT` | `/api/albums/:id` | Modifica metadatos o agrega/remueve IDs de medios asociados |
| `DELETE`| `/api/albums/:id` | Elimina un álbum conservando los medios en la galería |

### Pagos (Google Pay)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/payments/config/google-pay` | Obtiene la configuración pública para el cliente web de Google Pay |
| `POST` | `/api/payments/google-pay/process` | Procesa y verifica el pago con Google Pay y actualiza el plan |
| `GET` | `/api/payments/history/:userId` | Devuelve el historial completo de facturación del usuario |

### Inteligencia Artificial (Gemini)
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/ai/auto-tag` | Análisis multimodal de imagen/video y generación de etiquetas |
| `POST` | `/api/ai/edit` | Transformación generativa guiada por instrucciones en lenguaje natural |

### Eventos en Tiempo Real e Importación
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/neural-stream` | Conexión Server-Sent Events (SSE) para actualizaciones instantáneas |
| `POST` | `/api/cloud/import` | Importa archivos externos directamente hacia Firebase Storage |
| `POST` | `/api/cloud/import-drive-batch`| Ingesta por lote desde Google Drive a la bóveda del usuario |
| `GET` | `/api/database/inspect` | Diagnóstico de conexión en vivo con Neon PostgreSQL y Firebase Storage |

---

## ⚙️ Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto (basado en `.env.example`):

```env
# Conexión a la base de datos PostgreSQL (Neon Serverless)
DATABASE_URL=postgresql://neondb_owner:tu_password@ep-ejemplo.us-east-1.aws.neon.tech/neondb?sslmode=require

# Puerto del servidor (por defecto 3000)
PORT=3000

# Clave de API de Google Gemini (opcional si se utiliza en AI Studio)
GEMINI_API_KEY=tu_clave_de_gemini_aqui

# Clave secreta para tokens y cifrado
JWT_SECRET=pixelsphere_super_secret_key_2026
```

---

## 🚀 Instalación y Puesta en Marcha

### 1. Instalar dependencias
```bash
npm install
```

### 2. Modo Desarrollo
Inicia el servidor unificado con soporte TypeScript y recarga rápida:
```bash
npm run dev
```
La aplicación estará disponible de inmediato en:
- **Web App & API:** [http://localhost:3000](http://localhost:3000)

### 3. Compilación para Producción
```bash
# Compilar el cliente frontend con Vite
npm run build

# Iniciar el servidor de producción
npm start
```

---

## 🛡️ Seguridad y Respaldo

- **Zero Server-Disk Storage:** No se acumulan archivos en el disco del servidor de hosting, previniendo agotamiento de espacio de almacenamiento local.
- **Cifrado en Reposo:** Cada objeto multimedia subido a Firebase Storage se procesa con algoritmos simétricos **AES-256-GCM**.
- **Autenticación Fuerte:** Doble factor de autenticación compatible con apps RFC 6238 TOTP estándar.
- **Purga Segura:** La papelera elimina definitivamente registros de PostgreSQL y objetos de Firebase Storage tras 30 días de antigüedad o por solicitud explícita del usuario.

---

## 📄 Licencia

Desarrollado y mantenido para la plataforma **PixelSphere**. Todos los derechos reservados.
