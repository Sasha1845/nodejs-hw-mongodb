import createHttpError from 'http-errors';
import {
  getAllContacts,
  getContactsById,
  createContact,
  updateContact,
  deleteContact,
} from '../services/contacts.js';
import {
  parsePaginationParams,
  parseSortParams,
  parseFilterParams,
} from '../utils/pagination.js';
import { savePhotoToCloudinary } from '../middlewares/upload.js';

export const getAllContactsController = async (req, res) => {
  const { page, perPage } = parsePaginationParams(req.query);
  const { sortBy, sortOrder } = parseSortParams(req.query);
  const filter = parseFilterParams(req.query);
  const userId = req.user._id;

  const contacts = await getAllContacts({
    page,
    perPage,
    sortBy,
    sortOrder,
    filter,
    userId,
  });

  res.status(200).json({
    status: 200,
    message: 'Successfully found contacts!',
    data: contacts,
  });
};

export const getContactByIdController = async (req, res) => {
  const { contactId } = req.params;
  const userId = req.user._id;
  const contact = await getContactsById(contactId, userId);

  if (!contact) {
    throw createHttpError(404, 'Contact not found');
  }

  res.status(200).json({
    status: 200,
    message: `Successfully found contact with id ${contactId}!`,
    data: contact,
  });
};

export const createContactController = async (req, res) => {
  const userId = req.user._id;
  let photoUrl = null;

  // Якщо є завантажений файл, зберігаємо його на Cloudinary
  if (req.file) {
    try {
      photoUrl = await savePhotoToCloudinary(
        req.file.buffer,
        req.file.originalname,
      );
    } catch {
      throw createHttpError(500, 'Failed to upload photo');
    }
  }

  const contactData = {
    ...req.body,
    photo: photoUrl,
  };

  const contact = await createContact(contactData, userId);

  res.status(201).json({
    status: 201,
    message: 'Successfully created a contact!',
    data: contact,
  });
};

export const patchContactController = async (req, res) => {
  const { contactId } = req.params;
  const userId = req.user._id;
  let photoUrl = req.body.photo; // Зберігаємо існуюче фото якщо нове не завантажується

  // Якщо є новий завантажений файл, зберігаємо його на Cloudinary
  if (req.file) {
    try {
      photoUrl = await savePhotoToCloudinary(
        req.file.buffer,
        req.file.originalname,
      );
    } catch {
      throw createHttpError(500, 'Failed to upload photo');
    }
  }

  const updateData = {
    ...req.body,
  };

  // Додаємо URL фото тільки якщо воно є
  if (photoUrl) {
    updateData.photo = photoUrl;
  }

  const result = await updateContact(contactId, updateData, userId);

  if (!result) {
    throw createHttpError(404, 'Contact not found');
  }

  res.status(200).json({
    status: 200,
    message: 'Successfully patched a contact!',
    data: result,
  });
};

export const deleteContactController = async (req, res) => {
  const { contactId } = req.params;
  const userId = req.user._id;
  const contact = await deleteContact(contactId, userId);

  if (!contact) {
    throw createHttpError(404, 'Contact not found');
  }

  res.status(204).send();
};
