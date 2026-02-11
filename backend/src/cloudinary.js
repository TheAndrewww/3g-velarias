/**
 * Cloudinary Configuration
 * Handles image upload, optimization, and deletion
 */
const cloudinary = require('cloudinary').v2;

// Configure from env vars
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an image buffer to Cloudinary (FAST - no pre-processing)
 * @param {Buffer} buffer - Image data
 * @param {string} folder - Cloudinary folder (e.g. "3g-velarias/residential")
 * @param {string} publicId - Optional custom public ID
 * @returns {Promise<{url: string, thumbnailUrl: string, publicId: string}>}
 *
 * Optimization is done ON-DEMAND via URL transformations:
 * - Original URL: https://res.cloudinary.com/.../image.jpg
 * - Optimized: https://res.cloudinary.com/.../w_1200,f_auto,q_auto/.../image.jpg
 * - Thumbnail: https://res.cloudinary.com/.../w_400,f_auto,q_auto/.../image.jpg
 */
async function uploadImage(buffer, folder, publicId = null) {
    return new Promise((resolve, reject) => {
        const options = {
            folder,
            resource_type: 'image',
            // NO format conversion - keep original for flexibility
            // NO eager transformations - done on-demand for speed
        };

        if (publicId) {
            options.public_id = publicId;
        }

        const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);

            // Base URL of uploaded image
            const baseUrl = result.secure_url;

            // Generate optimized URLs using Cloudinary transformations
            // These are generated instantly, actual optimization happens when requested
            const optimizedUrl = baseUrl.replace(
                '/upload/',
                '/upload/w_1200,c_limit,f_auto,q_auto:good/'
            );

            const thumbnailUrl = baseUrl.replace(
                '/upload/',
                '/upload/w_400,c_limit,f_auto,q_auto:low/'
            );

            resolve({
                url: optimizedUrl, // Serve optimized version by default
                thumbnailUrl,
                publicId: result.public_id,
            });
        });

        uploadStream.end(buffer);
    });
}

/**
 * Upload from a file path (for migration script) - FAST upload
 */
async function uploadFromPath(filePath, folder) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(filePath, {
            folder,
            resource_type: 'image',
            // Fast upload - no pre-processing
        }, (error, result) => {
            if (error) return reject(error);

            const baseUrl = result.secure_url;

            // Generate transformation URLs (on-demand optimization)
            const optimizedUrl = baseUrl.replace(
                '/upload/',
                '/upload/w_1200,c_limit,f_auto,q_auto:good/'
            );

            const thumbnailUrl = baseUrl.replace(
                '/upload/',
                '/upload/w_400,c_limit,f_auto,q_auto:low/'
            );

            resolve({
                url: optimizedUrl,
                thumbnailUrl,
                publicId: result.public_id,
            });
        });
    });
}

/**
 * Delete an image from Cloudinary
 */
async function deleteImage(publicId) {
    return cloudinary.uploader.destroy(publicId);
}

module.exports = {
    cloudinary,
    uploadImage,
    uploadFromPath,
    deleteImage,
};
