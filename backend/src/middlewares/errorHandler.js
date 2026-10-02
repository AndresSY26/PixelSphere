export function errorHandler(err, req, res, next) {
  console.error('[Backend Global Error]:', err);
  const status = err.status || 500;
  const message = err.message || 'Error interno del servidor.';
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}
