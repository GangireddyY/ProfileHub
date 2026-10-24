import { UniqueConstraintError, ValidationError } from 'sequelize';
import { HttpError } from '../utils/http.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err instanceof UniqueConstraintError) {
    return res.status(409).json({ message: 'That record already exists' });
  }
  if (err instanceof ValidationError) {
    return res.status(400).json({ message: err.errors?.[0]?.message || 'Invalid data' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on our side' });
}
