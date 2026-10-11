<div align="center">

# 🌐 PixelSphere

### *Plataforma Multimedia Inteligente con IA Generativa, Bóveda Cifrada, Almacenamiento Zero-Disk y Google Pay*

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

## 📋 Tabla de Contenidos

1. [Descripción General](#-descripción-general)
2. [Pilares de la Arquitectura](#-pilares-de-la-arquitectura)
3. [Guía de Claves y Variables de Entorno (Paso a Paso)](#-guía-de-claves-y-variables-de-entorno)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Esquema de la Base de Datos (PostgreSQL)](#-esquema-de-la-base-de-datos-postgresql)
6. [Pasarela de Pagos (Google Pay)](#-pasarela-de-pagos-google-pay)
7. [Subida y Streaming Multimedia (Zero-Disk)](#-subida-y-streaming-multimedia-zero-disk)
8. [Inteligencia Artificial con Google Gemini](#-inteligencia-artificial-con-google-gemini)
9. [Seguridad, Bóveda Privada y 2FA](#-seguridad-bóveda-privada-y-2fa)
10. [Referencia Completa de la API REST (`/api`)](#-referencia-completa-de-la-api-rest-api)
11. [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
12. [Solución de Problemas Comunes](#-solución-de-problemas-comunes)

---

## 📖 Descripción General

**PixelSphere** es una suite multimedia integral de grado empresarial diseñada para la ingesta, procesamiento, custodia cifrada y análisis inteligente de fotografías y videos de ultra alta definición. 

Combina una arquitectura frontend reactiva en **React 19** con un servidor backend unificado en **Node.js/Express (TypeScript)**, almacenamiento descentralizado en **Firebase Cloud Storage**, base de datos relacional serverless en **Neon PostgreSQL**, y modelos fundacionales multimodales **Google Gemini**.

---

## 🏛️ Pilares de la Arquitectura

### 1. 🗄️ Persistencia Relacional en Neon PostgreSQL
- Modelos estructurados para usuarios, medios, álbumes, pagos, logros y auditoría de vistas.
- Autoinicialización de tablas (`CREATE TABLE IF NOT EXISTS`) e índices relacionales en el primer arranque.
- Cero dependencia de archivos `.json` locales para almacenamiento persistente.

### 2. ☁️ Arquitectura Zero-Disk con Firebase Storage
- **Zero Server-Disk Storage:** Los medios no se conservan en el disco físico del servidor, protegiendo al contenedor de agotamiento de espacio.
- **Cifrado AES-256-GCM:** Cifrado simétrico de nivel militar aplicado antes del guardado en la nube.
- **Streaming en Memoria (HTTP 206 Partial Content):** Reproducción fluida de video MP4/WebM y audio con soporte de saltos de reproducción (seeking) directo desde el buffer de memoria.

### 3. 💳 Pasarela de Pagos Nativa con Google Pay
- Integración oficial con **Google Pay Web API**.
- Tokenización de tarjetas y checkout seguro para suscripciones a planes (`Pro` y `Enterprise`).
- Emisión de recibos digitales auditables y ampliación instantánea de cuota de almacenamiento.

### 4. 🤖 Visión Artificial e IA Multimodal con Google Gemini
- Análisis automático de contenido mediante el SDK oficial `@google/genai`.
- Extracción de etiquetas semánticas, detección de objetos, clasificación de contenido adulto y paletas cromáticas.
- Herramienta de edición fotográfica asistida por lenguaje natural.

### 5. 🔐 Bóveda Cifrada y Autenticación Fuerte
- Sección **Vault (Bóveda)** protegida por contraseña maestra independiente.
- Doble Factor de Autenticación **2FA TOTP (RFC 6238)** compatible con Google Authenticator y Authy con códigos QR dinámicos.
- Algoritmo de dispersión criptográfica SHA-512 con salt por usuario para credenciales.

---

## 🔑 Guía de Claves y Variables de Entorno

> **¿Qué claves se necesitan y en qué orden configurarlas?**  
> Para poner a funcionar la aplicación, se requiere un archivo `.env` en la raíz del proyecto. A continuación se desglosan en orden de prioridad:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      ORDEN DE CONFIGURACIÓN                            │
├─────────┬───────────────────────────────┬──────────────────────────────┤
│ Prioridad│ Clave / Variable              │ Para qué sirve               │
├─────────┼───────────────────────────────┼──────────────────────────────┤
│    1    │ DATABASE_URL                  │ Conexión a Neon PostgreSQL   │
│    2    │ JWT_SECRET                    │ Firma de tokens y sesiones   │
│    3    │ PORT                          │ Puerto del servidor HTTP     │
│    4    │ Firebase (Bucket & Proyecto)  │ Almacenamiento multimedia    │
│    5    │ GEMINI_API_KEY (Opcional)     │ Inteligencia artificial      │
└─────────┴───────────────────────────────┴──────────────────────────────┘
```

### Plantilla completa de `.env`

Copia el archivo `.env.example` o crea un archivo `.env` con el siguiente contenido:

```bash
# -------------------------------------------------------------
# 1. BASE DE DATOS (OBLIGATORIA)
# Obtenla gratis en https://neon.tech creando un proyecto PostgreSQL.
# -------------------------------------------------------------
DATABASE_URL=postgresql://neondb_owner:tu_password_aqui@ep-ejemplo.us-east-1.aws.neon.tech/neondb?sslmode=require

# -------------------------------------------------------------
# 2. CONFIGURACIÓN DEL SERVIDOR
# -------------------------------------------------------------
PORT=3000
JWT_SECRET=pixelsphere_llave_secreta_segura_2026_xyz123

# -------------------------------------------------------------
# 3. FIREBASE STORAGE (Almacenamiento Zero-Disk en la Nube)
# Obtenla en la consola de Firebase: https://console.firebase.google.com
# -------------------------------------------------------------
# Para el Servidor (Backend):
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_STORAGE_BUCKET=tu-proyecto-firebase.firebasestorage.app
FIREBASE_API_KEY=AIzaSyTuClaveDeApiFirebaseAqui

# Para el Cliente Web (Frontend):
VITE_FIREBASE_PROJECT_ID=tu-proyecto-firebase
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto-firebase.firebasestorage.app
VITE_FIREBASE_API_KEY=AIzaSyTuClaveDeApiFirebaseAqui
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto-firebase.firebaseapp.com

# -------------------------------------------------------------
# 4. INTELIGENCIA ARTIFICIAL (GOOGLE GEMINI)
# Obtenla en https://aistudio.google.com/
# (En el entorno administrado de Google AI Studio se inyecta automáticamente)
# -------------------------------------------------------------
GEMINI_API_KEY=tu_clave_de_gemini_aqui

# -------------------------------------------------------------
# 5. GOOGLE PAY (Opcional / Por defecto modo TEST activo)
# Obtenla en https://pay.google.com/business/console
# -------------------------------------------------------------
GOOGLE_PAY_MERCHANT_ID=12345678901234567890
GOOGLE_PAY_MERCHANT_NAME=PixelSphere Cloud
```

---

## 📂 Estructura del Proyecto

```plaintext
PixelSphere/
├── server.ts                             # Servidor Full-Stack unificado (Express + Vite SSR/Middleware + API)
├── package.json                          # Manifiesto raíz, scripts de compilación y dependencias
├── metadata.json                         # Metadatos del applet en AI Studio y capacidades declaradas
├── .env.example                          # Plantilla documentada de variables de entorno
├── firebase-applet-config.example.json   # Configuración de Firebase de ejemplo (sin secretos)
│
├── backend/                              # Capa de Backend (Node.js ESM)
│   ├── package.json                      # Dependencias de servidor (@google/genai, pg, sharp, otplib, multer)
│   ├── server.js                         # Servidor autónomo alternativo para despliegue aislado de API
│   └── src/
│       ├── config/
│       │   └── constants.js              # Constantes criptográficas (AES-256-GCM), rutas efímeras y cuotas
│       ├── db/
│       │   └── index.js                  # Pool PostgreSQL (pg), inicialización DDL y gestión de transacciones
│       ├── controllers/
│       │   ├── authController.js         # Registro, Login, 2FA TOTP, perfiles de usuario
│       │   ├── mediaController.js        # Ingesta por chunks, optimización WebP, streaming y papelera
│       │   ├── albumController.js        # Gestión jerárquica de álbumes y asignación de fotos
│       │   ├── aiController.js           # Auto-etiquetado y transformaciones con Google Gemini
│       │   ├── paymentController.js      # Pasarela Google Pay, verificación y recibos auditables
│       │   ├── streamController.js       # Canal Server-Sent Events (/api/neural-stream)
│       │   ├── cloudController.js        # Importación externa y sincronización con Google Drive
│       │   └── statsController.js        # Métricas administrativas, historial de vistas y logros
│       ├── middlewares/
│       │   ├── uploadMiddleware.js       # Multer en memoria (MemoryStorage) para subidas por fragmentos
│       │   └── errorHandler.js           # Manejador global de excepciones HTTP con respuestas JSON
│       ├── routes/
│       │   ├── index.js                  # Enrutador central montado en /api
│       │   ├── authRoutes.js             # Endpoints /api/auth/*
│       │   ├── mediaRoutes.js            # Endpoints /api/media/*
│       │   ├── albumRoutes.js            # Endpoints /api/albums/*
│       │   ├── aiRoutes.js               # Endpoints /api/ai/*
│       │   └── paymentRoutes.js          # Endpoints /api/payments/* (Google Pay y suscripciones)
│       └── services/
│           ├── storageService.js         # Capa de datos sobre PostgreSQL con caché inteligente
│           ├── cloudStorageService.js    # SDK directo con Firebase Cloud Storage (cifrado y streaming)
│           ├── mediaOptimizationService.js # Compresión Sharp, generación de miniaturas WebP y cifrado
│           ├── cryptoService.js          # Cifrado AES-256-GCM, derivación PBKDF2 y TOTP
│           ├── eventService.js           # Emisor de eventos en tiempo real para clientes SSE
│           └── geminiService.js          # Integración con Google Gemini vía @google/genai
│
├── frontend/                             # Capa de Frontend SPA (Vite + React 19 + Tailwind CSS)
│   ├── index.html                        # Entrada HTML5 con meta tags PWA, OpenGraph y Leaflet CSS
│   ├── vite.config.js                    # Configuración de Vite con soporte SPA y proxying
│   ├── tailwind.config.js                # Paleta futurista, modo oscuro y animaciones fluidas
│   ├── public/
│   │   ├── manifest.json                 # Manifiesto de PWA para instalación en móviles y escritorio
│   │   └── sw.js                         # Service Worker para caché offline y rendimiento
│   └── src/
│       ├── main.jsx                      # Inicialización del árbol React en el DOM
│       ├── App.jsx                       # Rutas principales con React Router v6
│       ├── api/
│       │   └── client.js                 # Cliente HTTP con manejo defensivo de errores y JSON parsing
│       ├── components/
│       │   ├── google-pay-checkout-dialog.tsx # Modal de pago integrado con la pasarela de Google Pay
│       │   ├── upgrade-plan-dialog.tsx   # Selector de planes (Free, Pro, Enterprise)
│       │   ├── upload-dialog.tsx         # Diálogo de subida por fragmentos (chunked upload) con reintentos
│       │   ├── media-card.tsx            # Tarjeta de galería con vista previa, menú contextual y tags
│       │   ├── neural-video-player.tsx   # Reproductor de video con streaming continuo
│       │   ├── world-map.tsx             # Mapa mundial con Leaflet y agrupación geográfica de fotos
│       │   ├── google-drive-picker.tsx   # Selector de importación desde Google Drive
│       │   ├── pwa-installer.tsx         # Indicador de instalación de la app nativa
│       │   └── ui/                       # Biblioteca de componentes accesibles (Radix UI)
│       ├── pages/
│       │   ├── gallery.tsx               # Galería general con búsqueda facetada, filtros y ordenación
│       │   ├── vault.tsx                 # Bóveda privada protegida por PIN maestro y cifrado
│       │   ├── albums.tsx                # Administrador de colecciones y álbumes
│       │   ├── editor.tsx                # Editor de imágenes con IA generativa
│       │   ├── world.tsx                 # Visualización de medios geolocalizados en mapa
│       │   ├── timeline.tsx              # Línea de tiempo cronológica por fechas
│       │   ├── settings.tsx              # Preferencias de usuario, seguridad 2FA y facturación
│       │   ├── trash.tsx                 # Papelera de reciclaje con purga a los 30 días
│       │   ├── bridge.tsx                # Sincronización en la nube con Google Drive
│       │   ├── achievements.tsx          # Panel de insignias y gamificación
│       │   └── admin.tsx                 # Métricas globales de uso, almacenamiento y pagos
│       ├── lib/
│       │   ├── google-pay.ts             # Cliente de integración con la API de Google Pay Web
│       │   ├── storage.ts                # Adaptador local de persistencia de sesión
│       │   ├── utils.ts                  # Formateadores de fecha, tamaño de archivo y clases CSS
│       │   └── types.ts                  # Tipos TypeScript compartidos
│       └── hooks/
│           ├── use-neural-sync.ts        # Hook de sincronización en tiempo real vía SSE
│           └── use-toast.ts              # Sistema de notificaciones toast
```

---

## 🗄️ Esquema de la Base de Datos (PostgreSQL)

La base de datos se aloja en **Neon PostgreSQL** y consta de las siguientes tablas relacionales con integridad referencial:

| Tabla | Columnas Principales | Descripción |
| :--- | :--- | :--- |
| **`users`** | `id`, `email`, `password_hash`, `name`, `role`, `two_factor_secret`, `two_factor_enabled`, `plan`, `storage_limit_bytes` | Cuentas de usuario, credenciales, estado 2FA y límites de cuota según plan contratado. |
| **`media`** | `id`, `user_id`, `filename`, `type`, `url`, `thumbnail_url`, `cloud_storage_path`, `cloud_url`, `size`, `is_private`, `is_favorite`, `is_trash`, `tags`, `metadata` | Archivos fotográficos y de video, referencias en Firebase Storage, tags IA y geolocalización. |
| **`albums`** | `id`, `user_id`, `title`, `description`, `parent_id`, `cover_media_id`, `media_ids`, `is_public` | Álbumes jerárquicos y colecciones temáticas. |
| **`payments`** | `id`, `user_id`, `plan`, `billing_cycle`, `amount_usd`, `currency`, `payment_method`, `transaction_reference`, `card_last4`, `status`, `created_at` | Registro auditable de pagos procesados mediante Google Pay. |
| **`achievements`** | `id`, `user_id`, `badge_id`, `unlocked_at` | Sistema de logros de usuario (primer upload, uso de bóveda, etc.). |
| **`view_history`** | `id`, `user_id`, `media_id`, `viewed_at` | Historial cronológico de reproducciones y visualizaciones. |

---

## 💳 Pasarela de Pagos (Google Pay)

PixelSphere implementa un flujo completo de suscripciones con **Google Pay**:

```
[Usuario selecciona Plan] ──► [Abre Modal Google Pay]
                                       │
                                       ▼
                         [Google Pay Web API Autoriza]
                                       │
                                       ▼
                       [POST /api/payments/google-pay/process]
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
[Registra en tabla `payments`]                             [Actualiza tabla `users`]
- Referencia transaccional                                  - user.plan = 'pro' | 'enterprise'
- Monto y moneda                                            - user.storage_limit_bytes ampliado
- Últimos 4 dígitos de tarjeta
```

### Planes Disponibles

- **Free Tier:** 5 GB de almacenamiento, auto-etiquetado estándar.
- **Pro Tier ($9.99 USD/mes):** 100 GB de almacenamiento, IA avanzada sin límites, video 4K HDR.
- **Enterprise Tier ($29.99 USD/mes):** 1 TB de almacenamiento, soporte prioritario, bóvedas ilimitadas.

---

## 🚀 Subida y Streaming Multimedia (Zero-Disk)

### Subida por Fragmentos Resiliente (Chunked Uploads)
Para garantizar subidas confiables en conexiones inestables o archivos pesados (videos de varios gigabytes):

1. **División en fragmentos:** El frontend segmenta el archivo en bloques de 4 MB.
2. **Reintentos con Backoff Exponencial:** Si ocurre una interrupción de red (`Failed to fetch`), el cliente reintenta automáticamente hasta 3 veces por fragmento antes de reportar fallo.
3. **Ensamblado y Cifrado:** Al recibir el último fragmento, el backend une los bloques, optimiza miniaturas WebP con Sharp, cifra el contenido con AES-256-GCM y lo transfiere directamente a Firebase Cloud Storage.
4. **Limpieza Inmediata:** Los archivos temporales locales se eliminan inmediatamente tras la confirmación de subida en la nube.

### Streaming HTTP 206 (Partial Content)
El endpoint `/uploads/*` implementa soporte nativo para peticiones de rango de bytes (`Range: bytes=start-end`), permitiendo adelantar o retroceder en videos HD/4K sin necesidad de descargar el archivo completo en el navegador.

---

## 🤖 Inteligencia Artificial con Google Gemini

El servicio `geminiService.js` interactúa con los modelos multimodales **Gemini 2.5 Flash** mediante `@google/genai`:

- **Auto-etiquetado Inteligente:** Identifica lugares, personas, tipos de animales, objetos, actividades y estilo fotográfico.
- **Detección de Contenido Sensible:** Clasifica imágenes para sugerir su resguardo en la Bóveda Privada.
- **Edición Fotográfica por Lenguaje Natural:** Aplica modificaciones y transformaciones artísticas basadas en instrucciones del usuario.

---

## 🔐 Seguridad, Bóveda Privada y 2FA

- **Bóveda Independiente:** Los medios marcados como `is_private: true` quedan aislados de la galería pública y solo se desbloquean ingresando la contraseña maestra de la bóveda.
- **Doble Factor de Autenticación (2FA TOTP):** Implementado con la librería estándar `otplib`. Genera códigos QR compatibles con cualquier aplicación móvil RFC 6238.
- **Cero Datos Sensibles Expuestos:** El frontend nunca recibe contraseñas en texto plano ni secretos criptográficos del servidor.

---

## 📡 Referencia Completa de la API REST (`/api`)

### 1. Autenticación y Cuentas
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Crea una nueva cuenta con contraseña cifrada (SHA-512) |
| `POST` | `/api/auth/login` | Inicia sesión y valida credenciales (soporta desafío 2FA) |
| `POST` | `/api/auth/2fa/setup` | Genera nuevo secreto TOTP y código QR para Google Authenticator |
| `POST` | `/api/auth/2fa/confirm` | Valida código de 6 dígitos y activa 2FA en el perfil |
| `POST` | `/api/auth/2fa/disable` | Desactiva 2FA tras verificar contraseña actual |
| `GET` | `/api/auth/profile/:id` | Devuelve el perfil del usuario, plan y cuota de almacenamiento |
| `PUT` | `/api/auth/profile/:id` | Actualiza nombre, avatar y opciones de personalización |

### 2. Medios y Subidas
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/media` | Consulta medios con filtros (`type`, `albumId`, `isPrivate`, `isFavorite`, `isTrash`) |
| `POST` | `/api/upload` | Subida de archivos por fragmentos (chunked upload) para archivos pesados |
| `POST` | `/api/media/upload` | Subida directa multipart de imágenes o videos individuales |
| `GET` | `/api/media/:id` | Información detallada, etiquetas IA y metadatos EXIF |
| `PUT` | `/api/media/:id` | Modifica metadatos, favoritos o envía a la papelera |
| `DELETE` | `/api/media/:id` | Purga permanente de la base de datos y de Firebase Storage |
| `GET` | `/uploads/*` | Proxy seguro de entrega y streaming HTTP 206 desde Firebase Storage |

### 3. Álbumes y Carpetas
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/albums` | Lista álbumes creados por el usuario con conteo de elementos |
| `POST` | `/api/albums` | Crea un nuevo álbum con título, descripción y privacidad |
| `PUT` | `/api/albums/:id` | Actualiza título o agrega/remueve IDs de medios |
| `DELETE` | `/api/albums/:id` | Elimina el álbum sin borrar los medios asociados |

### 4. Pagos y Google Pay
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/payments/config/google-pay` | Obtiene la configuración de pasarela (Merchant ID, Redes permitidas) |
| `POST` | `/api/payments/google-pay/process` | Procesa y verifica el token de Google Pay y actualiza el plan |
| `GET` | `/api/payments/history/:userId` | Devuelve el historial completo de facturación del usuario |

### 5. Inteligencia Artificial y Nube
| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/ai/auto-tag` | Ejecuta análisis multimodal sobre una imagen y genera etiquetas |
| `POST` | `/api/ai/edit` | Aplica transformaciones generativas guiadas por texto |
| `GET` | `/api/neural-stream` | Conexión Server-Sent Events (SSE) para sincronización multi-dispositivo |
| `POST` | `/api/cloud/import-drive-batch` | Importación en bloque desde Google Drive |
| `GET` | `/api/database/inspect` | Diagnóstico del estado de la base de datos PostgreSQL y Storage |

---

## 🛠️ Instalación y Puesta en Marcha

### Prerrequisitos
- **Node.js:** Versión 20 o superior instalada.
- **npm:** Versión 10 o superior.
- **Base de Datos PostgreSQL:** Cadena de conexión de Neon (`DATABASE_URL`).

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone https://github.com/tu-usuario/pixelsphere.git
cd pixelsphere
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Edita el archivo .env con tus credenciales (DATABASE_URL, Firebase, etc.)
```

### 3. Ejecutar en Modo Desarrollo
El servidor ejecuta el backend y sirve el frontend reactivo en un solo proceso unificado:
```bash
npm run dev
```
La aplicación estará disponible en:
👉 **[http://localhost:3000](http://localhost:3000)**

### 4. Compilar y Desplegar para Producción
```bash
# Compilar el frontend optimizado con Vite
npm run build

# Iniciar el servidor en producción
npm start
```

---

## 🔧 Solución de Problemas Comunes

### 1. `TypeError: Failed to fetch` durante la subida de archivos
- **Causa:** Conexión interrumpida o tamaño de fragmento excesivo para la red.
- **Solución implementada:** El cliente ahora divide los archivos en fragmentos de 4 MB y cuenta con 3 reintentos automáticos con backoff exponencial. El servidor admite CORS con cabeceras explícitas de autenticación.

### 2. `SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON`
- **Causa:** Una petición a una ruta de API no coincidente estaba cayendo en el fallback SPA de Vite devolviendo el archivo `index.html`.
- **Solución implementada:** Se ha configurado un manejador estricto para `/api/*` que siempre responde con `status 404` en formato JSON (`{ "error": "Not Found", "message": "API route not found" }`), y el cliente HTTP valida el `Content-Type` antes de procesar la respuesta.

### 3. Error de conexión con PostgreSQL (`ECONNREFUSED` o `ETIMEDOUT`)
- **Causa:** La URL de base de datos no contiene el flag de SSL requerido por los servidores en la nube de Neon.
- **Solución:** Asegúrate de que el parámetro `?sslmode=require` esté presente al final de tu `DATABASE_URL`.

---

<div align="center">

**PixelSphere** — Desarrollado para una experiencia multimedia sin límites, segura y asistida por Inteligencia Artificial.

</div>
