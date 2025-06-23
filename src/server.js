import express from 'express';
import cors from 'cors';
import pino from 'pino-http';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import contactsRouter from './routers/contacts.js';
import authRouter from './routers/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';

dotenv.config();

const PORT = Number(process.env.PORT);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const setupServer = async () => {
  const app = express();

  app.use(express.json());
  app.use(cors());
  app.use(cookieParser());

  app.use(
    pino({
      transport: {
        target: 'pino-pretty',
      },
    }),
  );

  // Swagger documentation setup
  const swaggerPath = path.join(__dirname, 'docs', 'swagger.json');

  if (fs.existsSync(swaggerPath)) {
    try {
      const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

      const swaggerOptions = {
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info { margin-bottom: 30px; }
          .swagger-ui .scheme-container { background: #fafafa; padding: 15px; margin-bottom: 20px; }
        `,
        customSiteTitle: 'Contact Manager API Documentation',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'list',
          filter: true,
          showRequestHeaders: true,
          tryItOutEnabled: true,
          supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        },
      };

      app.use(
        '/api-docs',
        swaggerUi.serve,
        swaggerUi.setup(swaggerDocument, swaggerOptions),
      );

      // Додатковий роут для отримання raw JSON документації
      app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerDocument);
      });

      console.log('📚 Swagger documentation loaded successfully');
    } catch (error) {
      console.warn('⚠️  Could not parse swagger documentation:', error.message);
      app.get('/api-docs', (req, res) => {
        res.status(500).json({
          error: 'Documentation could not be loaded',
          message: 'Please run "npm run build-docs" to generate documentation',
        });
      });
    }
  } else {
    console.warn('⚠️  swagger.json not found');
    console.warn('💡 Run "npm run build-docs" to generate swagger.json');

    // Fallback роут якщо документація відсутня
    app.get('/api-docs', (req, res) => {
      res.status(404).json({
        error: 'Documentation not available',
        message: 'Please run "npm run build-docs" to generate documentation',
        commands: ['npm run build-docs', 'npm restart'],
      });
    });
  }

  app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to Contact Manager API! 👋',
      documentation: '/api-docs',
      endpoints: {
        contacts: '/contacts',
        auth: '/auth',
      },
    });
  });

  app.use('/contacts', contactsRouter);
  app.use('/auth', authRouter);

  app.use(notFoundHandler);

  app.use(errorHandler);

  app.listen(PORT || 3000, () => {
    console.log(`🚀 Server is running on port ${PORT || 3000}`);
    console.log(
      `📚 API Documentation available at: http://localhost:${
        PORT || 3000
      }/api-docs`,
    );
    console.log(
      `📄 Raw API spec available at: http://localhost:${
        PORT || 3000
      }/api-docs.json`,
    );
  });
};
