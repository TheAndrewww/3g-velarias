# 3G Velarias - Frontend

Sitio web estático para 3G Velarias, empresa de arquitectura textil.

## Características

- 🏠 **Landing Page** con split-screen (Residencial/Industrial)
- 🏡 **Sitio Residencial** - Pérgolas, Terrazas, Cocheras, Jardines
- 🏭 **Sitio Industrial** - Estacionamientos, Comercial, Escuelas, Deportivos
- 📱 **Responsive Design** - Optimizado para móviles y tablets
- 🗺️ **Mapas Interactivos** - Leaflet.js para mostrar ubicaciones
- 🎨 **Temas personalizados** - Claro (residencial) / Oscuro (industrial)
- ⚡ **Performance** - Sitio estático ultra-rápido
- 🔍 **SEO Optimizado** - Meta tags, schema.org, sitemap

## Stack Tecnológico

- HTML5 + CSS3
- JavaScript Vanilla (ES6+)
- Tailwind CSS (vía CDN)
- Leaflet.js (mapas)
- Google Fonts (Outfit)

## Estructura

```
frontend/public/
├── index.html              # Landing page
├── residencial/
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── logo.svg
├── industrial/
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── logo.svg
├── images/                 # Assets e imágenes de proyectos
│   └── proyectos/
│       ├── residencial/
│       └── industrial/
├── js/
│   └── project-data.js     # Datos de proyectos (auto-generado)
├── Logo-3G.svg
├── robots.txt
└── sitemap.xml
```

## Desarrollo Local

### Opción 1: Python HTTP Server (Recomendado)
```bash
npm run dev
# O manualmente:
python3 -m http.server 5173 --directory public
```

### Opción 2: Live Server (VS Code)
Instalar extensión "Live Server" y hacer click derecho en `index.html` → "Open with Live Server"

### Opción 3: Node.js http-server
```bash
npx http-server public -p 5173
```

El sitio estará disponible en: http://localhost:5173

## Deployment a Vercel

### Método 1: GitHub (Recomendado)
1. Push a GitHub
2. Importar en Vercel
3. Configurar:
   - Root Directory: `frontend`
   - Output Directory: `public`
4. Deploy automático

### Método 2: Vercel CLI
```bash
npm install -g vercel
cd frontend
vercel
```

## Configuración

### Actualizar URL de la API

Si el backend está en producción, actualizar en:
- `public/residencial/script.js`
- `public/industrial/script.js`

```javascript
// Desarrollo
const API_URL = 'http://localhost:3001';

// Producción
const API_URL = 'https://tu-backend.railway.app';
```

### Personalizar contenido

#### Proyectos
Los proyectos se cargan desde `js/project-data.js`, que es generado automáticamente por el admin panel.

#### Información de contacto
Editar en cada archivo `index.html`:
- Teléfono
- Email
- Dirección
- Redes sociales

#### Imágenes
Colocar imágenes en:
- `images/proyectos/residencial/` - Proyectos residenciales
- `images/proyectos/industrial/` - Proyectos industriales

## SEO y Rendimiento

### Meta Tags
Cada página incluye:
- Open Graph (Facebook, WhatsApp)
- Twitter Cards
- Schema.org markup
- Canonical URLs

### Optimizaciones
- Lazy loading de imágenes
- Compresión Gzip (Vercel automático)
- CDN global (Vercel)
- Caching headers configurados

### Sitemap
Actualizar `sitemap.xml` con tus URLs de producción:
```xml
<url>
  <loc>https://3gvelarias.com/</loc>
  <lastmod>2024-01-27</lastmod>
  <priority>1.0</priority>
</url>
```

## Dominio Personalizado

En Vercel:
1. Settings → Domains
2. Add Domain: `3gvelarias.com`
3. Configurar DNS:
   - Type: A Record
   - Name: @
   - Value: 76.76.21.21

## Contenido Dinámico

El frontend puede trabajar en dos modos:

### Modo Estático (Default)
- Carga datos de `js/project-data.js`
- No requiere backend en runtime
- Máximo performance
- Ideal para proyectos que no cambian frecuentemente

### Modo API (Futuro)
- Consulta API del backend en cada carga
- Contenido siempre actualizado
- Requiere backend activo
- Ver comentarios en código para implementar

## Browser Support

- Chrome/Edge (últimas 2 versiones)
- Firefox (últimas 2 versiones)
- Safari (últimas 2 versiones)
- Mobile browsers (iOS Safari, Chrome Android)

## Licencia

MIT
