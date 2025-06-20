import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import createHttpError from 'http-errors';

// Налаштування Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Налаштування multer для завантаження в пам'ять
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Перевіряємо тип файлу
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(createHttpError(400, 'Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB максимум
  },
});

// Middleware для завантаження одного файлу
export const uploadToCloudinary = upload.single('photo');

// Функція для завантаження на Cloudinary
export const savePhotoToCloudinary = async (buffer) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: 'image',
          folder: 'contacts',
          public_id: `contact_${Date.now()}`,
          format: 'jpg',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' },
          ],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        },
      )
      .end(buffer);
  });
};
