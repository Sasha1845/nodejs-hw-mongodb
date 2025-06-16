import { Contact } from '../db/models/contact.js';
import { calculatePaginationData } from '../utils/pagination.js';

export const getAllContacts = async ({
  page = 1,
  perPage = 10,
  sortBy = 'name',
  sortOrder = 'asc',
  filter = {},
} = {}) => {
  const limit = perPage;
  const skip = (page - 1) * perPage;

  // Створюємо об'єкт сортування для MongoDB
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const contactsQuery = Contact.find(filter);
  const [contacts, totalCount] = await Promise.all([
    contactsQuery.skip(skip).limit(limit).sort(sortOptions).exec(),
    Contact.find(filter).countDocuments(),
  ]);

  const paginationData = calculatePaginationData(totalCount, page, perPage);

  return {
    data: contacts,
    ...paginationData,
  };
};

export const getContactsById = async (contactId) => {
  const contact = await Contact.findById(contactId);
  return contact;
};

export const createContact = async (payload) => {
  const contact = await Contact.create(payload);
  return contact;
};

export const updateContact = async (contactId, payload, options = {}) => {
  const rawResult = await Contact.findOneAndUpdate(
    { _id: contactId },
    payload,
    {
      new: true,
      includeResultMetadata: true,
      ...options,
    },
  );

  if (!rawResult || !rawResult.value) return null;

  return rawResult.value;
};

export const deleteContact = async (contactId) => {
  const contact = await Contact.findOneAndDelete({
    _id: contactId,
  });

  return contact;
};
