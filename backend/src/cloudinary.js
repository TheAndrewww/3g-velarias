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
 * Upload an image buffer to Cloudinary
 * @param {Buffer} buffer - Image data
 * @param {string} folder - Cloudinary folder (e.g. "3g-velarias/residential")
 * @param {string} publicId - Optional custom public ID
 * @returns {Promise<{url: string, thumbnailUrl: string, publicId: string}>}
 */
async function uploadImage(buffer, folder, publicId = null) {
    return new Promise((resolve, reject) => {
        const options = {
            folder,
            format: 'webp',
            quality: 'auto:good',
            transformation: [
                { width: 1200, crop: 'limit' }, // Max 1200px wide
            ],
            eager: [
                { width: 400, crop: 'limit', quality: 'auto:low', format: 'webp' }, // Thumbnail
            ],
            eager_async: false,
        };

        if (publicId) {
            options.public_id = publicId;
        }

        const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);

            const thumbnailUrl = result.eager && result.eager[0]
                ? result.eager[0].secure_url
                : result.secure_url;

            resolve({
                url: result.secure_url,
                thumbnailUrl,
                publicId: result.public_id,
            });
        });

        uploadStream.end(buffer);
    });
}

/**
 * Upload from a file path (for migration script)
 */
async function uploadFromPath(filePath, folder) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(filePath, {
            folder,
            format: 'webp',
            quality: 'auto:good',
            transformation: [
                { width: 1200, crop: 'limit' },
            ],
            eager: [
                { width: 400, crop: 'limit', quality: 'auto:low', format: 'webp' },
            ],
            eager_async: false,
        }, (error, result) => {
            if (error) return reject(error);

            const thumbnailUrl = result.eager && result.eager[0]
                ? result.eager[0].secure_url
                : result.secure_url;

            resolve({
                url: result.secure_url,
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
