/**
 * Database connection for batch processing
 */

import { Pool, PoolConfig } from 'pg';
import { SecretsManager } from 'aws-sdk';

interface DatabaseCredentials {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

async function getDbCredentialsFromSecretsManager(): Promise<DatabaseCredentials> {
  const secretsManager = new SecretsManager({
    region: process.env.AWS_REGION || 'ap-northeast-1',
  });

  const secretName = process.env.SECRETS_MANAGER_SECRET_NAME;
  if (!secretName) {
    throw new Error('SECRETS_MANAGER_SECRET_NAME not configured');
  }

  try {
    const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    if (!data.SecretString) {
      throw new Error('Secret value is empty');
    }

    return JSON.parse(data.SecretString);
  } catch (error) {
    console.error('Failed to retrieve database credentials:', error);
    throw error;
  }
}

function getDbCredentialsFromEnv(): DatabaseCredentials {
  return {
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    dbname: process.env.DATABASE_NAME || 'facility_db',
  };
}

export async function createDbPool(): Promise<Pool> {
  const isProduction = process.env.NODE_ENV === 'production';

  const credentials = isProduction
    ? await getDbCredentialsFromSecretsManager()
    : getDbCredentialsFromEnv();

  const poolConfig: PoolConfig = {
    user: credentials.username,
    password: credentials.password,
    host: credentials.host,
    port: credentials.port,
    database: credentials.dbname,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
    max: 5, // Batch processing doesn't need many connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  const pool = new Pool(poolConfig);

  // Test connection
  try {
    const client = await pool.connect();
    console.log('Database connection established');
    client.release();
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }

  return pool;
}

export async function closeDbPool(pool: Pool): Promise<void> {
  await pool.end();
  console.log('Database connection closed');
}
