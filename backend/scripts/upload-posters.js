/**
 * Script to upload poster images to Cloudinary
 */
require('dotenv').config();
const { uploadFromPath } = require('../src/cloudinary');
const path = require('path');

async function uploadPosters() {
    try {
        console.log('Uploading poster images to Cloudinary...\n');

        // Upload residencial poster
        console.log('Uploading residencial poster...');
        const residencialPath = path.join(__dirname, '../../frontend/temp-videos/residencial-poster.jpg');
        const residencialResult = await uploadFromPath(residencialPath, '3g-velarias/posters');
        console.log('✓ Residencial poster uploaded:');
        console.log('  URL:', residencialResult.url);
        console.log('  Public ID:', residencialResult.publicId);
        console.log();

        // Upload industrial poster
        console.log('Uploading industrial poster...');
        const industrialPath = path.join(__dirname, '../../frontend/temp-videos/industrial-poster.jpg');
        const industrialResult = await uploadFromPath(industrialPath, '3g-velarias/posters');
        console.log('✓ Industrial poster uploaded:');
        console.log('  URL:', industrialResult.url);
        console.log('  Public ID:', industrialResult.publicId);
        console.log();

        console.log('All posters uploaded successfully!');
        console.log('\nResidencial poster URL:', residencialResult.url);
        console.log('Industrial poster URL:', industrialResult.url);

    } catch (error) {
        console.error('Error uploading posters:', error);
        process.exit(1);
    }
}

uploadPosters();
