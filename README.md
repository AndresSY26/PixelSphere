<div align="center">

# 🌐 PixelSphere
### *Arquitectura Desacoplada: Backend 100% Node.js (JavaScript) & Frontend Vite + React (SPA)*

[![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.21-lightgrey?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-6.4-purple?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Google Gemini AI](https://img.shields.io/badge/Google%20Gemini-AI%20Studio-orange?style=for-the-badge&logo=google)](https://aistudio.google.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-green?style=for-the-badge&logo=pwa)](https://developer.mozilla.org/es/docs/Web/Progressive_web_apps)

</div>

---

## 📖 Descripción General

**PixelSphere** ha evolucionado hacia una **arquitectura moderna y completamente desacoplada**, separando estrictamente las responsabilidades entre el servidor y el cliente:

1. **Backend (Node.js en JavaScript Puro):**
   - API REST construida con **Express.js** en módulos ECMAScript nativos (`"type": "module"`).
   - Motor de persistencia en disco con archivos JSON atómicos (`users.json`, `media.json`, `albums.json`, `achievements.json`).
   - Cifrado simétrico AES-256-CBC para la bóveda secreta, hashing SHA-512 y autenticación 2FA (TOTP) con `otplib` y códigos QR.
   - Streaming de video de alta definición con cabeceras `Range` (HTTP 206 Partial Content).
   - Servidor de eventos en tiempo real vía **Server-Sent Events (SSE)** en `/api/neural-stream`.
   - Integración nativa con **Google Gemini AI SDK** (`@google/generative-ai`) para auto-etiquetado multimodal y edición generativa.

2. **Frontend (Vite + React SPA):**
   - Aplicación de página única (SPA) ultra rápida construida con **Vite**, **React 19** y **Tailwind CSS**.
   - Navegación instantánea del lado del cliente con **React Router v6**.
   - Componentes modulares accesibles basados en **Radix UI** y **Lucide Icons**.
   - Visualización cartográfica interactiva con **Leaflet** y geolocalización.
   - Reproductor de video con streaming neural y buffer progresivo.
   - PWA instalable con Service Worker (`sw.js`) y soporte offline.

---

## 🏗️ Estructura del Repositorio

```plaintext
PixelSphere/
├── backend/                       # 100% Node.js en JavaScript Puro (ESM)
│   ├── package.json
│   ├── server.js                  # Servidor Express, CORS, Estáticos y Rutas
│   ├── .env.example               # Variables de entorno requeridas
│   ├── uploads/                   # Almacenamiento físico de imágenes y videos
│   ├── data/                      # Persistencia en archivos JSON estructurados
│   └── src/
│       ├── config/
│       │   └── constants.js       # Rutas absolutas, claves y constantes
│       ├── controllers/
│       │   ├── authController.js  # Login, Registro, 2FA TOTP, Perfiles
│       │   ├── mediaController.js # CRUD, Subida Multer, Streaming HTTP 206
│       │   ├── albumController.js # Gestión jerárquica de álbumes
│       │   ├── aiController.js    # Auto-tagging y edición con Gemini AI
│       │   ├── streamController.js# Canal SSE para actualizaciones en vivo
│       │   ├── cloudController.js # Importación de archivos remotos a disco
│       │   └── statsController.js # Métricas de administración y logros
│       ├── middlewares/
│       │   ├── uploadMiddleware.js# Multer con almacenamiento por usuario/tipo
│       │   └── errorHandler.js    # Manejador global estructurado de errores
│       ├── routes/
│       │   ├── index.js           # Enrutador principal montado en /api
│       │   ├── authRoutes.js      # Rutas /api/auth
│       │   ├── mediaRoutes.js     # Rutas /api/media
│       │   ├── albumRoutes.js     # Rutas /api/albums
│       │   └── aiRoutes.js        # Rutas /api/ai
│       └── services/
│           ├── storageService.js  # Motor atómico de persistencia RAM + Disco
│           ├── cryptoService.js   # AES-256-CBC, SHA-512 y TOTP
│           ├── geminiService.js   # Cliente oficial de Google Gemini
│           └── eventService.js    # Emisor y gestor de clientes SSE
│
├── frontend/                      # Cliente SPA (Vite + React + Tailwind + PWA)
│   ├── package.json
│   ├── vite.config.js             # Configuración de Vite, alias y proxy a :5000
│   ├── index.html                 # Punto de entrada HTML con PWA meta tags
│   ├── public/
│   │   ├── sw.js                  # Service Worker
│   │   └── manifest.json          # Manifiesto de la aplicación web
│   └── src/
│       ├── api/
│       │   └── client.js          # Cliente HTTP centralizado hacia el Backend
│       ├── components/            # Componentes de UI (Radix, Dialogs, Cards)
│       ├── pages/                 # Vistas: Gallery, Vault, World, Editor, etc.
│       ├── hooks/                 # useNeuralSync (SSE), useToast, useMobile
│       ├── lib/                   # storage.ts (adaptador cliente), utils.ts
│       ├── App.jsx                # Configuración de rutas con React Router
│       └── main.jsx               # Renderizado raíz de React
│
├── package.json                   # Orquestador monorepo (scripts concurrentes)
├── README.md                      # Documentación completa del proyecto
└── .gitignore                     # Exclusión de dependencias, uploads y secrets
```

---

## ⚙️ Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/AndresSY26/PixelSphere.git
cd PixelSphere
```

### 2. Configurar el Backend
Crea el archivo `.env` dentro de la carpeta `backend/`:
```bash
cd backend
cp .env.example .env
```
Edita `backend/.env` con tu clave de Google Gemini:
```env
PORT=5000
FRONTEND_URL=http://localhost:5173
GOOGLE_GENAI_API_KEY=tu_clave_de_gemini_aqui
JWT_SECRET=tu_secreto_seguro_2026
```

### 3. Instalar dependencias
Desde la raíz del proyecto ejecuta:
```bash
# Instala dependencias del orquestador, backend y frontend
npm install
npm --prefix backend install
npm --prefix frontend install
```

---

## 💻 Ejecución del Proyecto

### Opción A: Ejecutar Todo con un Solo Comando (Recomendado)
Desde la raíz del proyecto ejecuta:
```bash
npm run dev
```
Este comando levantará concurrentemente:
- **Backend Node.js:** [http://localhost:5000](http://localhost:5000)
- **Frontend Vite:** [http://localhost:5173](http://localhost:5173)

### Opción B: Ejecutar por Separado

**Backend:**
```bash
cd backend
npm run dev
# Servidor activo en http://localhost:5000
```

**Frontend:**
```bash
cd frontend
npm run dev
# Aplicación activa en http://localhost:5173
```

---

## 📡 Referencia de la API REST (`/api`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Registro de nuevo usuario |
| `POST` | `/api/auth/login` | Inicio de sesión con verificación de contraseña y 2FA |
| `POST` | `/api/auth/2fa/setup` | Generación de secreto TOTP y código QR |
| `POST` | `/api/auth/2fa/confirm` | Confirmación y activación de 2FA |
| `GET` | `/api/auth/profile/:id` | Consulta de perfil de usuario |
| `GET` | `/api/media` | Listado de medios con filtros (tipo, álbum, privados, búsqueda) |
| `POST` | `/api/media/upload` | Subida física de archivos (Multer) con auto-etiquetado IA |
| `GET` | `/api/media/:id/stream` | Streaming de video con cabeceras HTTP 206 (Range) |
| `PUT` | `/api/media/:id` | Actualización de metadatos de medio |
| `DELETE`| `/api/media/:id` | Eliminación o traslado a papelera |
| `GET` | `/api/albums` | Consulta de álbumes del usuario |
| `POST` | `/api/albums` | Creación de nuevo álbum |
| `POST` | `/api/ai/auto-tag` | Auto-etiquetado semántico con Gemini AI |
| `POST` | `/api/ai/edit` | Edición generativa de imágenes con prompts |
| `GET` | `/api/neural-stream` | Canal en tiempo real (Server-Sent Events) |
| `GET` | `/api/stats/admin` | Métricas y estadísticas de uso del sistema |
| `GET` | `/health` | Verificación de estado del servidor |

---

## 🚢 Compilación de Producción

### Frontend
```bash
cd frontend
npm run build
```
Genera los archivos optimizados listos para producción en `frontend/dist/`.

### Backend
```bash
cd backend
npm start
```
Inicia el servidor Node.js en modo producción.

---

## 📄 Licencia

Desarrollado y mantenido por [@AndresSY26](https://github.com/AndresSY26). Todos los derechos reservados.