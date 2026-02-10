#!/usr/bin/env node
/**
 * Optimize Existing Images
 * 
 * Processes all uploaded project images to generate:
 * - Optimized WebP (max 1200px wide, quality 80)
 * - Thumbnail WebP (max 400px wide, quality 70)
 * 
 * Usage: node scripts/optimize-existing.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'proyectos');
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

async function processImage(filePath, type) {
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));

    const optimizedDir = path.join(dir, 'optimized');
    const thumbDir = path.join(dir, 'thumbnails');
    fs.mkdirSync(optimizedDir, { recursive: true });
    fs.mkdirSync(thumbDir, { recursive: true });

    const optimizedPath = path.join(optimizedDir, `${baseName}.webp`);
    const thumbPath = path.join(thumbDir, `${baseName}-thumb.webp`);

    // Skip if already processed
    if (fs.existsSync(optimizedPath) && fs.existsSync(thumbPath)) {
        console.log(`  ⏭  ${path.basename(filePath)} — already processed`);
        return { skipped: true };
    }

    const origSize = fs.statSync(filePath).size;

    // Generate optimized version
    await sharp(filePath)
        .resize(1200, null, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(optimizedPath);

    // Generate thumbnail
    await sharp(filePath)
        .resize(400, null, { withoutEnlargement: true })
        .webp({ quality: 70 })
        .toFile(thumbPath);

    const optSize = fs.statSync(optimizedPath).size;
    const thumbSize = fs.statSync(thumbPath).size;
    const savings = ((1 - optSize / origSize) * 100).toFixed(1);

    console.log(`  ✅ ${path.basename(filePath)}: ${(origSize / 1024 / 1024).toFixed(2)}MB → ${(optSize / 1024).toFixed(0)}KB optimized, ${(thumbSize / 1024).toFixed(0)}KB thumb (${savings}% savings)`);

    return {
        skipped: false,
        originalSize: origSize,
        optimizedSize: optSize,
        thumbSize: thumbSize
    };
}

async function main() {
    console.log('🔍 Scanning for images to optimize...\n');

    if (!fs.existsSync(UPLOADS_DIR)) {
        console.log('No uploads directory found. Nothing to process.');
        return;
    }

    const types = fs.readdirSync(UPLOADS_DIR).filter(d =>
        fs.statSync(path.join(UPLOADS_DIR, d)).isDirectory() &&
        !['optimized', 'thumbnails'].includes(d)
    );

    let totalOriginal = 0;
    let totalOptimized = 0;
    let totalProcessed = 0;
    let totalSkipped = 0;

    for (const type of types) {
        const typeDir = path.join(UPLOADS_DIR, type);
        console.log(`📁 Processing ${type}/`);

        const files = fs.readdirSync(typeDir).filter(f => {
            const ext = path.extname(f).toLowerCase();
            const fullPath = path.join(typeDir, f);
            return IMAGE_EXTENSIONS.includes(ext) && fs.statSync(fullPath).isFile();
        });

        if (files.length === 0) {
            console.log('  No images found.\n');
            continue;
        }

        for (const file of files) {
            try {
                const result = await processImage(path.join(typeDir, file), type);
                if (result.skipped) {
                    totalSkipped++;
                } else {
                    totalOriginal += result.originalSize;
                    totalOptimized += result.optimizedSize;
                    totalProcessed++;
                }
            } catch (err) {
                console.error(`  ❌ Error processing ${file}:`, err.message);
            }
        }
        console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Summary:`);
    console.log(`   Processed: ${totalProcessed} images`);
    console.log(`   Skipped:   ${totalSkipped} images`);
    if (totalProcessed > 0) {
        console.log(`   Original:  ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Optimized: ${(totalOptimized / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Savings:   ${((1 - totalOptimized / totalOriginal) * 100).toFixed(1)}%`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
