import { drizzle } from 'drizzle-orm/node-postgres'

import * as schema from './schema.ts'

const databaseUrl = process.env.DATABASE_URL_DEV

if (!databaseUrl) {
  throw new Error(
    'Database connection string is not set. Define DATABASE_URL_DEV for local development or DATABASE_URL for production.',
  )
}

export const db = drizzle(databaseUrl, { schema })
