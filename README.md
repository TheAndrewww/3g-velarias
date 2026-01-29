# 3G Velarias - Proyecto Web Completo

Sitio web profesional para 3G Velarias, empresa de arquitectura textil especializada en pérgolas, terrazas, estacionamientos y estructuras comerciales e industriales.

## Estructura del Proyecto

```
3g-velarias/
├── frontend/              # Sitio web estático (Vercel)
│   ├── public/           # Archivos públicos
│   │   ├── index.html    # Landing page
│   │   ├── residencial/  # Sitio residencial
│   │   ├── industrial/   # Sitio industrial
│   │   ├── images/       # Imágenes y assets
│   │   └── js/          # JavaScript & project-data.js
│   ├── vercel.json      # Configuración Vercel
│   └── package.json
│
├── backend/              # API y Admin Panel (Railway)
│   ├── src/
│   │   ├── server.js    # Servidor Express
│   │   └── admin-public/# Admin HTML/JS/CSS
│   ├── data/            # Base de datos JSON
│   │   └── projects.json
│   ├── uploads/         # Imágenes subidas
│   ├── .env             # Variables de entorno (NO commitear)
│   ├── .env.example     # Plantilla de .env
│   ├── railway.json     # Config Railway
│   ├── Procfile         # Config Render (alternativa)
│   └── package.json
│
└── README.md            # Este archivo
```

## Stack Tecnológico

### Frontend
- HTML5, CSS3, JavaScript Vanilla
- Tailwind CSS (CDN)
- Leaflet.js (mapas)
- Deployment: **Vercel**

### Backend
- Node.js + Express
- Multer (uploads de imágenes)
- dotenv (variables de entorno)
- Autenticación HTTP Basic Auth
- Base de datos: JSON (migratable a PostgreSQL/MongoDB)
- Deployment: **Railway** o **Render**

## Desarrollo Local

### Prerequisitos
- Node.js >= 18.0.0
- npm o yarn
- Git

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd 3g-velarias
```

### 2. Configurar Backend

```bash
cd backend
npm install

# Copiar archivo de variables de entorno
cp .env.example .env

# Editar .env con tus credenciales
nano .env
```

Configurar las variables en `.env`:
```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
ADMIN_USERNAME=tu_usuario
ADMIN_PASSWORD=tu_password_seguro
```

### 3. Iniciar Backend

```bash
npm run dev
```

El servidor estará disponible en:
- Admin Panel: http://localhost:3001/admin
- API: http://localhost:3001/api

### 4. Iniciar Frontend (en otra terminal)

```bash
cd ../frontend
npm run dev
```

El sitio estará disponible en: http://localhost:5173

## Deployment a Producción

### Opción 1: Vercel (Frontend) + Railway (Backend)

#### A. Deploy Backend en Railway

1. Crear cuenta en [Railway.app](https://railway.app)
2. Conectar tu repositorio de GitHub
3. Seleccionar el directorio `backend/`
4. Agregar variables de entorno en Railway:

```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://tu-sitio.vercel.app
BACKEND_URL=https://tu-backend.railway.app
ADMIN_USERNAME=admin
ADMIN_PASSWORD=TU_PASSWORD_SUPER_SEGURO
```

5. Railway detectará automáticamente `railway.json` y desplegará
6. Copiar la URL generada (ej: `https://tu-backend.railway.app`)

#### B. Deploy Frontend en Vercel

1. Crear cuenta en [Vercel.com](https://vercel.com)
2. Importar tu repositorio
3. Configurar:
   - **Root Directory:** `frontend`
   - **Build Command:** (vacío - es sitio estático)
   - **Output Directory:** `public`
4. Agregar variables de entorno en Vercel:

```
VITE_API_URL=https://tu-backend.railway.app
```

5. Deploy automático
6. Copiar URL generada (ej: `https://3g-velarias.vercel.app`)

#### C. Actualizar URLs cruzadas

1. En Railway, actualizar `FRONTEND_URL` con tu URL de Vercel
2. Volver a desplegar si es necesario

### Opción 2: Vercel + Render (Alternativa gratuita)

Mismo proceso pero usando [Render.com](https://render.com) en lugar de Railway.

**Render Free Tier:**
- El servidor se "duerme" después de 15 min de inactividad
- Primera carga puede tardar ~30 segundos
- Ideal para empezar sin costo

**Railway:**
- $5/mes después del trial
- Sin "sleep", siempre activo
- Mejor rendimiento

## Configuración Post-Deployment

### 1. Actualizar URLs en el código frontend

Si tu frontend hace llamadas a la API, actualiza las URLs en:
- `frontend/public/residencial/script.js`
- `frontend/public/industrial/script.js`

Buscar y reemplazar:
```javascript
// Antes
const API_URL = 'http://localhost:3001';

// Después
const API_URL = 'https://tu-backend.railway.app';
```

### 2. Configurar dominio personalizado (opcional)

#### En Vercel (Frontend):
1. Settings → Domains
2. Agregar `3gvelarias.com`
3. Configurar DNS según instrucciones

#### En Railway (Backend):
1. Settings → Domains
2. Agregar `api.3gvelarias.com`
3. Configurar DNS CNAME

### 3. Actualizar CORS

En `backend/src/server.js`, verificar que el dominio esté permitido:
```javascript
const corsOptions = {
    origin: [
        'https://3gvelarias.com',
        'https://www.3gvelarias.com',
        /\.vercel\.app$/
    ],
    credentials: true
};
```

## Uso del Admin Panel

### Acceso
1. Ir a `https://tu-backend.railway.app/admin`
2. Ingresar usuario y contraseña (HTTP Basic Auth)
3. Browser te pedirá las credenciales configuradas en `.env`

### Funcionalidades
- Crear, editar y eliminar proyectos
- Subir imágenes (hasta 10MB por imagen)
- Organizar imágenes con drag & drop
- Cambiar ubicación en mapa interactivo
- Filtrar y buscar proyectos

## Migración de Imágenes

Las imágenes actuales están en `images/proyectos/`. Para producción:

### Opción A: Subir todas las imágenes al backend
```bash
cd backend/uploads
mkdir -p proyectos/residencial proyectos/industrial
cp -r ../../images/proyectos/* proyectos/
```

### Opción B: Usar CDN (Recomendado)

Para mejor rendimiento, usar **Cloudinary** (gratis hasta 25GB):

1. Crear cuenta en [Cloudinary.com](https://cloudinary.com)
2. Subir imágenes a Cloudinary
3. Actualizar `projects.json` con URLs de Cloudinary:

```json
{
  "image": "https://res.cloudinary.com/tu-cloud/image/upload/v123/proyecto1.jpg",
  "images": [
    "https://res.cloudinary.com/tu-cloud/image/upload/v123/img1.jpg",
    "https://res.cloudinary.com/tu-cloud/image/upload/v123/img2.jpg"
  ]
}
```

## Actualización de Contenido

### Desarrollo (Local)
1. Editar via Admin Panel: http://localhost:3001/admin
2. Los cambios se guardan en `backend/data/projects.json`
3. Se genera automáticamente `frontend/public/js/project-data.js`
4. El frontend carga los datos del archivo JS

### Producción
1. Editar via Admin Panel: https://tu-backend.railway.app/admin
2. Los cambios se guardan en Railway
3. El frontend puede consumir la API directamente o seguir usando el JS estático

## Comandos Útiles

### Backend
```bash
npm start        # Producción
npm run dev      # Desarrollo
npm run prod     # Modo producción local
```

### Frontend
```bash
npm run dev      # Servidor de desarrollo (puerto 5173)
npm run preview  # Preview (puerto 8080)
```

## Seguridad

- ✅ HTTP Basic Auth en rutas de admin y API
- ✅ CORS configurado para dominios específicos
- ✅ Validación de tipo de archivo en uploads
- ✅ Headers de seguridad (XSS, clickjacking, etc)
- ✅ Variables de entorno para credenciales
- ✅ .gitignore configurado (no se suben .env ni uploads)

### Cambiar contraseña de admin

Editar `.env` en Railway:
```
ADMIN_PASSWORD=NuevaPasswordSegura123!
```

## Troubleshooting

### Error: "Cannot find module 'dotenv'"
```bash
cd backend
npm install
```

### Error: CORS en producción
Verificar que `FRONTEND_URL` en Railway coincida con la URL de Vercel

### Imágenes no se cargan
Verificar que las rutas en `projects.json` sean correctas y que las imágenes existan en `uploads/`

### Admin no acepta credenciales
Verificar variables de entorno `ADMIN_USERNAME` y `ADMIN_PASSWORD` en Railway

## Roadmap Futuro

- [ ] Migrar de JSON a PostgreSQL/MongoDB
- [ ] Implementar caché con Redis
- [ ] Optimización de imágenes automática (Sharp)
- [ ] Backup automático de la base de datos
- [ ] Sistema de autenticación JWT más robusto
- [ ] Panel de analytics

## Soporte

Para dudas o problemas:
1. Revisar este README
2. Revisar logs en Railway/Vercel
3. Contactar al desarrollador

## Licencia

MIT
