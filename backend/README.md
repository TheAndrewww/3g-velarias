# 3G Velarias - Backend API & Admin Panel

API REST y panel de administración para gestión de proyectos e imágenes.

## Stack

- Node.js + Express
- Multer (file uploads)
- dotenv (environment variables)
- HTTP Basic Authentication
- JSON file-based database

## Instalación

```bash
npm install
cp .env.example .env
# Editar .env con tus credenciales
npm start
```

## Variables de Entorno

```env
NODE_ENV=development          # development | production
PORT=3001                     # Puerto del servidor
FRONTEND_URL=http://...       # URL del frontend (CORS)
BACKEND_URL=http://...        # URL de este backend
ADMIN_USERNAME=admin          # Usuario del admin
ADMIN_PASSWORD=changeme123    # Contraseña del admin
```

## API Endpoints

### Autenticación
Todas las rutas `/api/*` y `/admin` requieren HTTP Basic Auth.

### GET /api/projects
Obtener todos los proyectos (residenciales e industriales)

**Response:**
```json
{
  "residentialProjects": [...],
  "industrialProjects": [...]
}
```

### POST /api/projects?type=residential
Crear nuevo proyecto

**Body:**
```json
{
  "category": "pergola",
  "title": "Proyecto Example",
  "location": "Irapuato, Gto.",
  "area": "120 m²",
  "duration": "3 semanas",
  "description": "...",
  "coordinates": [20.6767, -101.3563],
  "image": "/images/proyectos/residencial/img.jpg",
  "images": ["/images/proyectos/residencial/img1.jpg"]
}
```

### PUT /api/projects/:index?type=residential
Actualizar proyecto existente

### DELETE /api/projects/:index?type=residential
Eliminar proyecto

### POST /api/upload?type=residencial
Subir imágenes (multipart/form-data)

**Form Data:**
- `images`: Array de archivos (max 10MB cada uno)

**Response:**
```json
{
  "success": true,
  "paths": ["/images/proyectos/residencial/123-img.jpg"],
  "baseUrl": "https://backend-url.railway.app"
}
```

### GET /health
Health check (sin autenticación)

## Estructura

```
backend/
├── src/
│   ├── server.js           # Servidor principal
│   └── admin-public/       # Frontend del admin panel
│       ├── index.html
│       └── app.js
├── data/
│   └── projects.json       # Base de datos
├── uploads/
│   └── proyectos/          # Imágenes subidas
│       ├── residencial/
│       └── industrial/
├── .env                    # Variables de entorno (NO commitear)
├── .env.example
├── railway.json            # Config Railway
├── Procfile               # Config Render
└── package.json
```

## Deployment

### Railway
1. Conectar repositorio
2. Seleccionar directorio `backend/`
3. Agregar variables de entorno
4. Deploy automático

### Render
1. New Web Service
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Agregar variables de entorno

## Seguridad

- HTTP Basic Auth en todas las rutas sensibles
- CORS configurado para frontend específico
- Validación de tipos de archivo
- Límite de tamaño de archivo (10MB)
- Headers de seguridad

## Desarrollo

```bash
npm run dev     # Modo desarrollo
npm run prod    # Modo producción local
npm start       # Producción
```

## Notas

- La base de datos es un archivo JSON simple
- En desarrollo, sincroniza automáticamente con `frontend/public/js/project-data.js`
- En producción, el frontend debe consumir la API directamente
- Los uploads se guardan en `uploads/` (considerar migrar a S3/Cloudinary)
