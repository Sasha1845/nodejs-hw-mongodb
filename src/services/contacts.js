import { Contact } from '../db/models/contact.js';
import { calculatePaginationData } from '../utils/pagination.js';

export const getAllContacts = async ({
  page = 1,
  perPage = 10,
  sortBy = 'name',
  sortOrder = 'asc',
  filter = {},
  userId,
} = {}) => {
  const limit = perPage;
  const skip = (page - 1) * perPage;

  // Створюємо об'єкт сортування для MongoDB
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Додаємо userId до фільтра
  const searchFilter = { ...filter, userId };

  const contactsQuery = Contact.find(searchFilter);
  const [contacts, totalCount] = await Promise.all([
    contactsQuery.skip(skip).limit(limit).sort(sortOptions).exec(),
    Contact.find(searchFilter).countDocuments(),
  ]);

  const paginationData = calculatePaginationData(totalCount, page, perPage);

  return {
    data: contacts,
    ...paginationData,
  };
};

export const getContactsById = async (contactId, userId) => {
  const contact = await Contact.findOne({ _id: contactId, userId });
  return contact;
};

export const createContact = async (payload, userId) => {
  const contact = await Contact.create({ ...payload, userId });
  return contact;
};

export const updateContact = async (
  contactId,
  payload,
  userId,
  options = {},
) => {
  const rawResult = await Contact.findOneAndUpdate(
    { _id: contactId, userId },
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

export const deleteContact = async (contactId, userId) => {
  const contact = await Contact.findOneAndDelete({
    _id: contactId,
    userId,
  });

  return contact;
};
