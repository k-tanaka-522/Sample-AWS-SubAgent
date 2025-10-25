/**
 * Vendor API Entry Point
 */

import express, { Application } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Pool } from 'pg';
import { createDbPool, closeDbPool } from './db/connection';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createFacilitiesRouter } from './routes/facilities';
import { createMaintenanceRouter } from './routes/maintenance';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

let dbPool: Pool;

/**
 * Create Express app
 */
function createApp(db: Pool): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());

  // Body parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint (no authentication required)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
    });
  });

  // API routes (authentication required)
  app.use('/api/facilities', authenticate, createFacilitiesRouter(db));
  app.use('/api', authenticate, createMaintenanceRouter(db));

  // Error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Start server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize database connection
    dbPool = await createDbPool();

    // Create Express app
    const app = createApp(dbPool);

    // Start listening
    const server = app.listen(PORT, () => {
      console.log(`Vendor API server running on port ${PORT} in ${NODE_ENV} mode`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, closing server gracefully...');
      server.close(async () => {
        await closeDbPool(dbPool);
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, closing server gracefully...');
      server.close(async () => {
        await closeDbPool(dbPool);
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server
if (require.main === module) {
  startServer();
}

export { createApp };
