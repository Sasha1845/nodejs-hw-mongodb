import express from 'express';
import cors from 'cors';
import pino from 'pino-http';
import dotenv from 'dotenv';
import { getAllContactsController } from './controllers/contacts.controller.js';
import { getContactByIdController } from './controllers/contact.controller.js';
import { getAllContacts, getContactsById } from './services/contacts.js';

dotenv.config();

const PORT = Number(process.env.PORT);

export const setupServer = async () => {
  const app = express();
  app.use(express.json());

  app.use(cors());

  app.use(
    pino({
      transport: {
        target: 'pino-pretty',
      },
    }),
  );

  app.get('/', (req, res) => {
    res.send('Hello World!');
  });

  app.get('/contacts', async (req, res) => {
    const contacts = await getAllContacts();
    res.status(200).json({
      status: 200,
      message: 'Successfully found contacts!',
      data: contacts,
    });
  });
  app.get('/contacts', getAllContactsController);

  app.get('/contacts/:contactId', async (req, res) => {
    const { contactId } = req.params;
    const contact = await getContactsById(contactId);
    if (!contact) {
      res.status(404).json({
        message: 'Contact not found',
      });
    }
    res.status(200).json({
      status: 200,
      message: `Successfully found contact with id ${contactId}!`,
      data: contact,
    });
  });
  app.get('/contacts/:contactId', getContactByIdController);

  app.use((req, res) => {
    res.status(404).json({
      message: 'Not found',
    });
  });

  app.listen(PORT || 3000, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};
setupServer();
