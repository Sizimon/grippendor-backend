const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});



/**
 * Upload an image to Cloudinary.
 * @param {string} imageUrl - The local file path or URL of the image to upload.
 * @returns {Promise<string>} - The secure URL of the uploaded image.
 */
async function uploadImageToCloudinary(imageUrl) {
    try {
        const result = await cloudinary.uploader.upload(imageUrl, { folder: 'discord-events' });
        return result.secure_url;
    } catch (error) {
        console.error('Error uploading image to Cloudinary', error);
        throw error;
    }
}


// DELETE IMAGES RELATED TO EVENT IF EVENT IS DELETES --- TESTING!
async function deleteImagesFromCloudinary(imageUrls) {
    try {
        // Extract public IDs from the URLs
        const publicIds = imageUrls.map(url => {
            const parts = url.split('/');
            const publicIdWithExtension = parts[parts.length - 1]; // e.g., "image_name.jpg"
            return publicIdWithExtension.split('.')[0]; // Extract "image_name" (without extension)
        });

        // Delete the images using their public IDs
        if (publicIds.length > 0) {
            await cloudinary.api.delete_resources(publicIds);
            console.log(`Deleted images from Cloudinary: ${publicIds.join(', ')}`);
        }
    } catch (error) {
        console.error('Error deleting images from Cloudinary', error);
        throw error;
    }
}

module.exports = {
    uploadImageToCloudinary,
    deleteImagesFromCloudinary,
}
    