#!/usr/bin/env node
/**
 * Migrate from projects.json to PostgreSQL + Cloudinary
 * 
 * Usage:
 *   1. Set DATABASE_URL and CLOUDINARY_* env vars in .env
 *   2. Run: npx prisma migrate deploy  (or npx prisma db push)
 *   3. Run: node scripts/migrate-to-db.js
 * 
 * This script:
 *   - Reads projects.json
 *   - Uploads local images to Cloudinary
 *   - Keeps external URLs (Unsplash) as-is
 *   - Inserts all projects into PostgreSQL
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { uploadFromPath } = require('../src/cloudinary');

const prisma = new PrismaClient();
const DATA_PATH = path.join(__dirname, '..', 'data', 'projects.json');
const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');

function isLocalImage(url) {
    return url && url.startsWith('/images/');
}

function localPathToAbsolute(url) {
    // /images/proyectos/residential/file.png → /uploads/proyectos/residential/file.png
    const relative = url.replace('/images/', '');
    return path.join(UPLOADS_BASE, relative);
}

async function uploadLocalImage(imageUrl, type) {
    if (!isLocalImage(imageUrl)) {
        return imageUrl; // External URL, keep as-is
    }

    const localPath = localPathToAbsolute(imageUrl);

    if (!fs.existsSync(localPath)) {
        console.warn(`  ⚠️  File not found: ${localPath}, keeping URL as-is`);
        return imageUrl;
    }

    try {
        const result = await uploadFromPath(localPath, `3g-velarias/${type}`);
        console.log(`  ☁️  Uploaded: ${path.basename(localPath)} → ${result.url}`);
        return result.url;
    } catch (error) {
        console.error(`  ❌ Failed to upload ${localPath}: ${error.message}`);
        return imageUrl; // Keep original on failure
    }
}

async function migrate() {
    console.log('═══════════════════════════════════════');
    console.log('  Migration: JSON → PostgreSQL + Cloudinary');
    console.log('═══════════════════════════════════════\n');

    // Check prerequisites
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL not set in .env');
        process.exit(1);
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
        console.error('❌ CLOUDINARY_CLOUD_NAME not set in .env');
        process.exit(1);
    }

    // Read JSON data
    if (!fs.existsSync(DATA_PATH)) {
        console.error(`❌ projects.json not found at ${DATA_PATH}`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const residential = data.residentialProjects || [];
    const industrial = data.industrialProjects || [];

    console.log(`📋 Found ${residential.length} residential + ${industrial.length} industrial projects\n`);

    // Check if DB already has data
    const existingCount = await prisma.project.count();
    if (existingCount > 0) {
        console.warn(`⚠️  Database already has ${existingCount} projects.`);
        console.warn('   To re-migrate, first clear: npx prisma db push --force-reset');
        console.warn('   Skipping migration.\n');
        await prisma.$disconnect();
        return;
    }

    // Migrate residential projects
    console.log('🏠 Migrating residential projects...');
    for (const project of residential) {
        const mainImage = await uploadLocalImage(project.image, 'residential');
        const galleryImages = [];
        if (project.images) {
            for (const img of project.images) {
                galleryImages.push(await uploadLocalImage(img, 'residential'));
            }
        }

        await prisma.project.create({
            data: {
                type: 'residential',
                category: project.category || '',
                title: project.title || '',
                location: project.location || '',
                area: project.area || null,
                duration: project.duration || null,
                description: project.description || null,
                image: mainImage,
                images: galleryImages.length > 0 ? galleryImages : [mainImage],
                coordinates: project.coordinates || [],
            },
        });
        console.log(`  ✅ ${project.title}`);
    }

    // Migrate industrial projects
    console.log('\n🏭 Migrating industrial projects...');
    for (const project of industrial) {
        const mainImage = await uploadLocalImage(project.image, 'industrial');
        const galleryImages = [];
        if (project.images) {
            for (const img of project.images) {
                galleryImages.push(await uploadLocalImage(img, 'industrial'));
            }
        }

        await prisma.project.create({
            data: {
                type: 'industrial',
                category: project.category || '',
                title: project.title || '',
                location: project.location || '',
                area: project.area || null,
                duration: project.duration || null,
                description: project.description || null,
                image: mainImage,
                images: galleryImages.length > 0 ? galleryImages : [mainImage],
                coordinates: project.coordinates || [],
            },
        });
        console.log(`  ✅ ${project.title}`);
    }

    // Final count
    const finalCount = await prisma.project.count();
    console.log(`\n═══════════════════════════════════════`);
    console.log(`  ✅ Migration complete: ${finalCount} projects in database`);
    console.log(`═══════════════════════════════════════\n`);

    await prisma.$disconnect();
}

migrate().catch((error) => {
    console.error('Migration failed:', error);
    prisma.$disconnect();
    process.exit(1);
});
