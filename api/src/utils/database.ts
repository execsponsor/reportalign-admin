/**
 * Database connection utility for Azure Functions
 * Uses connection pooling with pg for PostgreSQL
 */

import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 5, // Low for serverless — functions scale independently
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    if (process.env.DB_SSL === 'true') {
      config.ssl = { rejectUnauthorized: false };
    }

    pool = new Pool(config);
  }

  return pool;
}

export { getPool };
