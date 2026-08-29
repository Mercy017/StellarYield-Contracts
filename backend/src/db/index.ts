import pg from "pg";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { AppError, ErrorCode } from "../api/middleware/errors.js";

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.db.url });

// Prepared statement registry for hot queries
const preparedStatements = new Map<string, { name: string; text: string }>();

export function registerPreparedStatement(name: string, text: string): void {
  preparedStatements.set(name, { name, text });
  logger.debug({ name }, "Registered prepared statement");
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
  options?: { timeoutMs?: number },
): Promise<T[]> {
  const timeoutMs = options?.timeoutMs;
  if (timeoutMs) {
    const client = await pool.connect();
    try {
      await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
      const result = await client.query(sql, params);
      return result.rows;
    } catch (err: any) {
      if (err?.code === "57014") {
        throw new AppError(ErrorCode.QUERY_TIMEOUT, "Query timed out", 504);
      }
      throw err;
    } finally {
      client.release();
    }
  }
  const result = await pool.query(sql, params);
  return result.rows;
}

export async function queryPrepared<T = Record<string, unknown>>(
  name: string,
  params?: unknown[],
  options?: { timeoutMs?: number },
): Promise<T[]> {
  const stmt = preparedStatements.get(name);
  if (!stmt) {
    throw new Error(`Prepared statement "${name}" not registered`);
  }
  const timeoutMs = options?.timeoutMs;
  if (timeoutMs) {
    const client = await pool.connect();
    try {
      await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
      const result = await client.query({ name: stmt.name, text: stmt.text, values: params });
      return result.rows;
    } catch (err: any) {
      if (err?.code === "57014") {
        throw new AppError(ErrorCode.QUERY_TIMEOUT, "Query timed out", 504);
      }
      throw err;
    } finally {
      client.release();
    }
  }
  const result = await pool.query({ name: stmt.name, text: stmt.text, values: params });
  return result.rows;
}

async function prepareStatements(): Promise<void> {
  for (const [key, stmt] of preparedStatements) {
    try {
      await pool.query(`PREPARE ${stmt.name} AS ${stmt.text}`);
      logger.debug({ name: key }, "Prepared statement cached");
    } catch {
      // Statement may already be prepared — ignore
    }
  }
  logger.info({ count: preparedStatements.size }, "Prepared statements initialized");
}

async function validateConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    logger.info("Database connection established");
  } finally {
    client.release();
  }
}

process.on("SIGTERM", async () => {
  logger.info("Shutting down database pool");
  await pool.end();
});

// Validate on startup — exit immediately if DATABASE_URL is unreachable
if (process.env["NODE_ENV"] !== "test") {
  validateConnection()
    .then(() => prepareStatements())
    .catch((err) => {
      logger.error(err, "Failed to connect to database");
      process.exit(1);
    });
}
