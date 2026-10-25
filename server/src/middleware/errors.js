import multer from 'multer';
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
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'That image is too large',
      LIMIT_FILE_COUNT: 'Too many photos in one upload',
      LIMIT_UNEXPECTED_FILE: 'Too many photos in one upload',
    };
    const message = messages[err.code] || 'Upload failed, please try again';
    return res.status(400).json({ message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }
  // Client errors raised by middleware (e.g. express.static's 404 for a missing upload).
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    const message = err.status === 404 ? 'Not found' : err.expose ? err.message : 'Bad request';
    return res.status(err.status).json({ message });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on our side' });
}
