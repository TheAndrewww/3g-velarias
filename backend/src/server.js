const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const sharp = require('sharp');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

// Security: Require critical environment variables in production
if (NODE_ENV === 'production') {
    if (!JWT_SECRET || JWT_SECRET.length < 32) {
        console.error('\x1b[31m%s\x1b[0m', '❌ FATAL: JWT_SECRET must be set and at least 32 characters in production');
        process.exit(1);
    }
    if (!ADMIN_PASSWORD || ADMIN_PASSWORD === 'changeme123') {
        console.error('\x1b[31m%s\x1b[0m', '❌ FATAL: ADMIN_PASSWORD must be changed from default in production');
        process.exit(1);
    }
    if (!ADMIN_USERNAME || ADMIN_USERNAME === 'admin') {
        console.warn('\x1b[33m%s\x1b[0m', '⚠️  WARNING: Consider changing ADMIN_USERNAME from default "admin"');
    }
} else {
    // Development fallbacks with warnings
    if (!JWT_SECRET) console.warn('⚠️  JWT_SECRET not set, using insecure default (OK for development)');
    if (!ADMIN_PASSWORD) console.warn('⚠️  ADMIN_PASSWORD not set, using default (OK for development)');
}

const SAFE_JWT_SECRET = JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-prod';
const SAFE_ADMIN_USERNAME = ADMIN_USERNAME || 'admin';
const SAFE_ADMIN_PASSWORD = ADMIN_PASSWORD || 'changeme123';

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // max 5 attempts per window per IP
    message: {
        success: false,
        error: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
const corsOptions = {
    origin: NODE_ENV === 'production'
        ? [FRONTEND_URL, /\.vercel\.app$/]
        : '*',
    credentials: true
};
app.use(cors(corsOptions));
app.use(compression()); // Gzip all responses
app.use(express.json());
app.use(cookieParser());

// Serve uploaded images with cache headers
app.use('/images', express.static(path.join(__dirname, '..', 'uploads'), {
    maxAge: '7d',
    immutable: true
}));


// Configure Multer for Image Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = req.query.type || 'residencial';
        const dir = path.join(__dirname, '..', 'uploads', 'proyectos', type);

        // Ensure directory exists
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Sanitize filename
        const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '-').toLowerCase();
        cb(null, `${Date.now()}-${safeName}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
        }
    }
});

/**
 * Process uploaded images with sharp:
 * - Optimized: max 1200px wide, WebP quality 80
 * - Thumbnail: max 400px wide, WebP quality 70
 */
async function processUploadedImages(files, type) {
    const results = [];

    for (const file of files) {
        const dir = path.dirname(file.path);
        const baseName = path.basename(file.filename, path.extname(file.filename));

        // Create output directories
        const optimizedDir = path.join(dir, 'optimized');
        const thumbDir = path.join(dir, 'thumbnails');
        fs.mkdirSync(optimizedDir, { recursive: true });
        fs.mkdirSync(thumbDir, { recursive: true });

        const optimizedName = `${baseName}.webp`;
        const thumbName = `${baseName}-thumb.webp`;

        try {
            // Generate optimized version (max 1200px wide)
            await sharp(file.path)
                .resize(1200, null, { withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(path.join(optimizedDir, optimizedName));

            // Generate thumbnail (max 400px wide)
            await sharp(file.path)
                .resize(400, null, { withoutEnlargement: true })
                .webp({ quality: 70 })
                .toFile(path.join(thumbDir, thumbName));

            const originalPath = `/images/proyectos/${type}/${file.filename}`;
            const optimizedPath = `/images/proyectos/${type}/optimized/${optimizedName}`;
            const thumbPath = `/images/proyectos/${type}/thumbnails/${thumbName}`;

            results.push({
                original: originalPath,
                optimized: optimizedPath,
                thumbnail: thumbPath
            });

            // Log savings
            const origSize = fs.statSync(file.path).size;
            const optSize = fs.statSync(path.join(optimizedDir, optimizedName)).size;
            const savings = ((1 - optSize / origSize) * 100).toFixed(1);
            console.log(`📸 ${file.filename}: ${(origSize / 1024 / 1024).toFixed(1)}MB → ${(optSize / 1024 / 1024).toFixed(1)}MB (${savings}% smaller)`);

        } catch (err) {
            console.error(`Error processing ${file.filename}:`, err.message);
            // Fallback to original if processing fails
            results.push({
                original: `/images/proyectos/${type}/${file.filename}`,
                optimized: `/images/proyectos/${type}/${file.filename}`,
                thumbnail: `/images/proyectos/${type}/${file.filename}`
            });
        }
    }

    return results;
}

// Database File Path
const DB_PATH = path.join(__dirname, '..', 'data', 'projects.json');
const FRONTEND_JS_PATH = NODE_ENV === 'development'
    ? path.join(__dirname, '..', '..', 'frontend', 'public', 'js', 'project-data.js')
    : null; // En producción no generamos JS, usamos API

// Helper: Read Data
function readData() {
    if (!fs.existsSync(DB_PATH)) return { residentialProjects: [], industrialProjects: [] };
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
}

// Helper: Write Data & Sync to JS (solo en desarrollo)
function writeData(data) {
    // 1. Write JSON
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4));

    // 2. Sync to JS File (solo en desarrollo para frontend local)
    if (FRONTEND_JS_PATH) {
        const jsContent = `/**
 * 3G Velarias - Project Data
 * Auto-generated by Admin Panel
 */

const residentialProjects = ${JSON.stringify(data.residentialProjects, null, 4)};

const industrialProjects = ${JSON.stringify(data.industrialProjects, null, 4)};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { residentialProjects, industrialProjects };
}
`;
        // Ensure directory exists
        const dir = path.dirname(FRONTEND_JS_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(FRONTEND_JS_PATH, jsContent);
    }
}

// Routes

// Get Config (for admin panel)
app.get('/api/config', (req, res) => {
    res.json({
        frontendUrl: FRONTEND_URL,
        backendUrl: process.env.BACKEND_URL || `http://localhost:${PORT}`,
        nodeEnv: NODE_ENV
    });
});

// Get All Projects
app.get('/api/projects', (req, res) => {
    try {
        const data = readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add Project (protected)
app.post('/api/projects', jwtAuth, (req, res) => {
    try {
        const { type } = req.query; // 'residential' or 'industrial'
        const newProject = req.body;

        // Input validation
        if (!newProject.title || typeof newProject.title !== 'string' || !newProject.title.trim()) {
            return res.status(400).json({ error: 'El campo "title" es requerido' });
        }
        if (!newProject.category || typeof newProject.category !== 'string') {
            return res.status(400).json({ error: 'El campo "category" es requerido' });
        }
        if (!newProject.location || typeof newProject.location !== 'string') {
            return res.status(400).json({ error: 'El campo "location" es requerido' });
        }

        // Sanitize string fields
        newProject.title = newProject.title.trim();
        newProject.category = newProject.category.trim().toLowerCase();
        newProject.location = newProject.location.trim();

        const data = readData();

        if (type === 'residential') {
            data.residentialProjects.unshift(newProject);
        } else {
            data.industrialProjects.unshift(newProject);
        }

        writeData(data);
        res.json({ success: true, project: newProject });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload Images (protected)
app.post('/api/upload', jwtAuth, (req, res) => {
    upload.array('images')(req, res, async (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    error: 'Archivo demasiado grande. El límite es 50MB por imagen.'
                });
            }
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No se subieron archivos'
                });
            }

            const type = req.query.type || 'residencial';
            const baseUrl = NODE_ENV === 'production'
                ? process.env.BACKEND_URL
                : `http://localhost:${PORT}`;

            // Process images with sharp
            const processed = await processUploadedImages(req.files, type);

            // Return both original paths (backward compat) and optimized paths
            const paths = processed.map(p => p.original);
            const optimizedPaths = processed.map(p => p.optimized);
            const thumbnailPaths = processed.map(p => p.thumbnail);

            res.json({
                success: true,
                paths,
                optimizedPaths,
                thumbnailPaths,
                baseUrl
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// Update Project (protected) - uses index but validates bounds
app.put('/api/projects/:index', jwtAuth, (req, res) => {
    try {
        const { type } = req.query;
        const index = parseInt(req.params.index);
        const updatedProject = req.body;
        const data = readData();

        const collection = type === 'residential' ? data.residentialProjects : data.industrialProjects;

        if (isNaN(index) || index < 0 || index >= collection.length) {
            return res.status(400).json({ error: 'Índice de proyecto inválido' });
        }

        if (type === 'residential') {
            data.residentialProjects[index] = updatedProject;
        } else {
            data.industrialProjects[index] = updatedProject;
        }

        writeData(data);
        res.json({ success: true, project: updatedProject });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Project (protected) - validates bounds
app.delete('/api/projects/:index', jwtAuth, (req, res) => {
    try {
        const { type } = req.query;
        const index = parseInt(req.params.index);
        const data = readData();

        const collection = type === 'residential' ? data.residentialProjects : data.industrialProjects;

        if (isNaN(index) || index < 0 || index >= collection.length) {
            return res.status(400).json({ error: 'Índice de proyecto inválido' });
        }

        if (type === 'residential') {
            data.residentialProjects.splice(index, 1);
        } else {
            data.industrialProjects.splice(index, 1);
        }

        writeData(data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Middleware de autenticación JWT para API (solo retorna JSON)
function jwtAuth(req, res, next) {
    const token = req.cookies.auth_token;

    if (!token) {
        return res.status(401).json({ error: 'No autenticado', requiresLogin: true });
    }

    try {
        const decoded = jwt.verify(token, SAFE_JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.clearCookie('auth_token');
        return res.status(401).json({ error: 'Token inválido o expirado', requiresLogin: true });
    }
}

// Middleware de autenticación para páginas HTML (redirige al login)
function requireAuth(req, res, next) {
    const token = req.cookies.auth_token;

    if (!token) {
        return res.redirect('/admin/login');
    }

    try {
        const decoded = jwt.verify(token, SAFE_JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.clearCookie('auth_token');
        return res.redirect('/admin/login');
    }
}

// Login endpoint (sin autenticación)
app.post('/api/login', loginLimiter, (req, res) => {
    const { username, password, remember } = req.body;

    if (username === SAFE_ADMIN_USERNAME && password === SAFE_ADMIN_PASSWORD) {
        // Generate JWT token
        const token = jwt.sign(
            { username: username },
            SAFE_JWT_SECRET,
            { expiresIn: remember ? '30d' : '24h' } // 30 days if remember, 24 hours otherwise
        );

        // Set cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: NODE_ENV === 'production', // Only HTTPS in production
            sameSite: 'strict',
            maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 24 hours
        });

        res.json({ success: true, message: 'Login exitoso' });
    } else {
        res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true, message: 'Logout exitoso' });
});

// Serve login page (sin autenticación)
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-public', 'login.html'));
});

// Serve the Admin HTML at /admin (CON autenticación - usa requireAuth que redirige)
app.get('/admin', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-public', 'index.html'));
});

// Health check endpoint (sin autenticación)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', environment: NODE_ENV });
});

// Serve Admin Static Files (JS, CSS, assets) - DESPUÉS de las rutas específicas
app.use('/admin', express.static(path.join(__dirname, 'admin-public')));

// Start Server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   3G Velarias - Backend Server       ║
╚═══════════════════════════════════════╝

🚀 Server running on port ${PORT}
🌍 Environment: ${NODE_ENV}
📁 Admin Panel: http://localhost:${PORT}/admin
🔐 Username: ${ADMIN_USERNAME}
⚡ API Base: http://localhost:${PORT}/api

Press Ctrl+C to stop
    `);
});
