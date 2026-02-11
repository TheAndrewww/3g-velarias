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
const { PrismaClient } = require('@prisma/client');
const { uploadImage } = require('./cloudinary');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
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

// Configure Multer for Image Uploads (memory storage — files go to Cloudinary, not disk)
const upload = multer({
    storage: multer.memoryStorage(),
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
 * Process and upload image to Cloudinary
 * 1. Resize with sharp (max 1200px)
 * 2. Convert to WebP 
 * 3. Upload buffer to Cloudinary
 */
async function processAndUpload(fileBuffer, originalName, type) {
    const origSize = fileBuffer.length;
    const origSizeMB = (origSize / 1024 / 1024).toFixed(1);

    console.log(`📸 Processing ${originalName} (${origSizeMB}MB)...`);

    // Optimize with sharp - use lower quality for very large images
    const quality = origSize > 10 * 1024 * 1024 ? 70 : 80; // 70% if >10MB

    const optimizedBuffer = await sharp(fileBuffer, {
        limitInputPixels: 268402689, // ~16k x 16k max
        sequentialRead: true // Memory efficient streaming
    })
        .resize(1200, null, {
            withoutEnlargement: true,
            fit: 'inside'
        })
        .webp({
            quality,
            effort: 4 // 0-6, lower = faster but less compression
        })
        .toBuffer({ resolveWithObject: false });

    const folder = `3g-velarias/${type}`;
    const baseName = path.basename(originalName, path.extname(originalName))
        .replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const publicId = `${Date.now()}-${baseName}`;

    const result = await uploadImage(optimizedBuffer, folder, publicId);

    const optSize = optimizedBuffer.length;
    const savings = ((1 - optSize / origSize) * 100).toFixed(1);
    console.log(`✅ ${originalName}: ${origSizeMB}MB → ${(optSize / 1024 / 1024).toFixed(1)}MB (${savings}% smaller, quality=${quality}%)`);

    return result;
}

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

// ==================== ROUTES ====================

// Get Config (for admin panel)
app.get('/api/config', (req, res) => {
    res.json({
        frontendUrl: FRONTEND_URL,
        backendUrl: process.env.BACKEND_URL || `http://localhost:${PORT}`,
        nodeEnv: NODE_ENV
    });
});

// Get All Projects — returns same format as old JSON for frontend compatibility
app.get('/api/projects', async (req, res) => {
    try {
        const residential = await prisma.project.findMany({
            where: { type: 'residential' },
            orderBy: { createdAt: 'desc' },
        });
        const industrial = await prisma.project.findMany({
            where: { type: 'industrial' },
            orderBy: { createdAt: 'desc' },
        });

        // Map to frontend format (strip internal fields)
        const mapProject = (p) => ({
            id: p.id,
            category: p.category,
            title: p.title,
            location: p.location,
            area: p.area,
            duration: p.duration,
            description: p.description,
            image: p.image,
            images: p.images,
            ...(p.coordinates.length > 0 && { coordinates: p.coordinates }),
        });

        res.json({
            residentialProjects: residential.map(mapProject),
            industrialProjects: industrial.map(mapProject),
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add Project (protected)
app.post('/api/projects', jwtAuth, async (req, res) => {
    try {
        const { type } = req.query; // 'residential' or 'industrial'
        const body = req.body;

        // Input validation
        if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
            return res.status(400).json({ error: 'El campo "title" es requerido' });
        }
        if (!body.category || typeof body.category !== 'string') {
            return res.status(400).json({ error: 'El campo "category" es requerido' });
        }
        if (!body.location || typeof body.location !== 'string') {
            return res.status(400).json({ error: 'El campo "location" es requerido' });
        }

        const project = await prisma.project.create({
            data: {
                type: type === 'residential' ? 'residential' : 'industrial',
                category: body.category.trim().toLowerCase(),
                title: body.title.trim(),
                location: body.location.trim(),
                area: body.area || null,
                duration: body.duration || null,
                description: body.description || null,
                image: body.image || '',
                images: body.images || [],
                coordinates: body.coordinates || [],
            },
        });

        res.json({ success: true, project });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload Images (protected) — processes with sharp then uploads to Cloudinary
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

            const type = req.query.type || 'residential';
            const results = [];

            for (const file of req.files) {
                const result = await processAndUpload(file.buffer, file.originalname, type);
                results.push(result);
            }

            // Return Cloudinary URLs — compatible with frontend
            const paths = results.map(r => r.url);
            const optimizedPaths = results.map(r => r.url);
            const thumbnailPaths = results.map(r => r.thumbnailUrl);

            res.json({
                success: true,
                paths,
                optimizedPaths,
                thumbnailPaths,
            });
        } catch (error) {
            console.error('Error uploading images:', error);
            console.error('Error stack:', error.stack);
            console.error('Cloudinary config:', {
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'MISSING',
                api_key: process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING',
                api_secret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING'
            });
            res.status(500).json({
                success: false,
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
});

// Update Project (protected) — now uses database ID
app.put('/api/projects/:id', jwtAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const body = req.body;

        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID de proyecto inválido' });
        }

        const existing = await prisma.project.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        const project = await prisma.project.update({
            where: { id },
            data: {
                category: body.category || existing.category,
                title: body.title || existing.title,
                location: body.location || existing.location,
                area: body.area !== undefined ? body.area : existing.area,
                duration: body.duration !== undefined ? body.duration : existing.duration,
                description: body.description !== undefined ? body.description : existing.description,
                image: body.image || existing.image,
                images: body.images || existing.images,
                coordinates: body.coordinates || existing.coordinates,
            },
        });

        res.json({ success: true, project });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete Project (protected) — now uses database ID
app.delete('/api/projects/:id', jwtAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID de proyecto inválido' });
        }

        const existing = await prisma.project.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        await prisma.project.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: error.message });
    }
});

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
app.get('/health', async (req, res) => {
    try {
        // Quick DB check
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', environment: NODE_ENV, database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', environment: NODE_ENV, database: 'disconnected' });
    }
});

// Serve Admin Static Files (JS, CSS, assets) - DESPUÉS de las rutas específicas
app.use('/admin', express.static(path.join(__dirname, 'admin-public')));

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

// Start Server with increased timeout for image processing
const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   3G Velarias - Backend Server       ║
╚═══════════════════════════════════════╝

🚀 Server running on port ${PORT}
🌍 Environment: ${NODE_ENV}
🗄️  Database: PostgreSQL (Prisma)
☁️  Images: Cloudinary
📁 Admin Panel: http://localhost:${PORT}/admin
🔐 Username: ${ADMIN_USERNAME}
⚡ API Base: http://localhost:${PORT}/api

Press Ctrl+C to stop
    `);
});

// Increase timeout to 5 minutes for large image uploads
server.timeout = 300000; // 5 minutes (default is 2 minutes)
server.keepAliveTimeout = 310000; // Slightly longer than timeout
