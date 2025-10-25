/**
 * Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode,
      },
    });
    return;
  }

  // Unexpected errors
  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal Server Error',
      statusCode: 500,
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      statusCode: 404,
    },
  });
}
