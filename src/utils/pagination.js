export const parsePaginationParams = (query) => {
  const { page, perPage } = query;

  const parsedPage = parseInt(page, 10);
  const parsedPerPage = parseInt(perPage, 10);

  return {
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    perPage:
      Number.isInteger(parsedPerPage) && parsedPerPage > 0 ? parsedPerPage : 10,
  };
};

export const parseSortParams = (query) => {
  const { sortBy, sortOrder } = query;

  const allowedSortFields = [
    'name',
    'phoneNumber',
    'email',
    'isFavourite',
    'contactType',
    'createdAt',
    'updatedAt',
  ];
  const allowedSortOrders = ['asc', 'desc'];

  return {
    sortBy: allowedSortFields.includes(sortBy) ? sortBy : 'name',
    sortOrder: allowedSortOrders.includes(sortOrder) ? sortOrder : 'asc',
  };
};

export const parseFilterParams = (query) => {
  const { type, isFavourite } = query;

  const allowedContactTypes = ['work', 'home', 'personal'];
  const filter = {};

  // Фільтрація за типом контакту
  if (type && allowedContactTypes.includes(type)) {
    filter.contactType = type;
  }

  // Фільтрація за улюбленими контактами
  if (isFavourite !== undefined) {
    if (isFavourite === 'true') {
      filter.isFavourite = true;
    } else if (isFavourite === 'false') {
      filter.isFavourite = false;
    }
  }

  return filter;
};

export const calculatePaginationData = (count, page, perPage) => {
  const totalPages = Math.ceil(count / perPage);

  return {
    page,
    perPage,
    totalItems: count,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
};
