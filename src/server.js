import express from 'express';
import cors from 'cors';
import pino from 'pino-http';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import contactsRouter from './routers/contacts.js';
import authRouter from './routers/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';

dotenv.config();

const PORT = Number(process.env.PORT);

export const setupServer = async () => {
  const app = express();

  // Middleware для парсингу JSON
  app.use(express.json());

  // Middleware для роботи з cookies
  app.use(cookieParser());

  // Налаштування CORS
  app.use(cors());

  // Логування запитів
  app.use(
    pino({
      transport: {
        target: 'pino-pretty',
      },
    }),
  );

  // Налаштування Swagger UI для документації API
  try {
    const swaggerDocument = JSON.parse(
      readFileSync(resolve('docs', 'swagger.json'), 'utf8'),
    );

    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Contact Manager API Documentation',
        swaggerOptions: {
          persistAuthorization: true,
        },
      }),
    );

    console.log('✅ Swagger documentation loaded successfully');
  } catch (error) {
    console.warn('⚠️ Failed to load Swagger documentation:', error.message);
    console.warn(
      '💡 Make sure to run "npm run build-docs" to generate swagger.json',
    );
  }

  // Основний роут
  app.get('/', (req, res) => {
    res.json({
      message: 'Contact Manager API is running!',
      documentation: `${req.protocol}://${req.get('host')}/api-docs`,
      endpoints: {
        auth: '/auth',
        contacts: '/contacts',
      },
    });
  });

  // API роути
  app.use('/contacts', contactsRouter);
  app.use('/auth', authRouter);

  // Middleware для обробки неіснуючих роутів (має бути перед errorHandler)
  app.use(notFoundHandler);

  // Middleware для обробки помилок (має бути останнім)
  app.use(errorHandler);

  // Запуск сервера
  app.listen(PORT || 3000, () => {
    console.log(`🚀 Server is running on port ${PORT || 3000}`);
    console.log(
      `📚 API Documentation: http://localhost:${PORT || 3000}/api-docs`,
    );
    console.log(`🌐 API Base URL: http://localhost:${PORT || 3000}`);
  });
};
