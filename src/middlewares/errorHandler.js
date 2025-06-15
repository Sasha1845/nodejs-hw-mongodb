const errorHandler = (err, req, res) => {
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';

  res.status(status).json({
    status,
    message: status === 500 ? 'Something went wrong' : message,
    data: err.message,
  });
};

export { errorHandler };
