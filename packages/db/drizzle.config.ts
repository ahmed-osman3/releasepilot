import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.local' })
config({ path: '.env' })
config({ path: '../../.env.local' })
config({ path: '../../.env' })

if (!process.env.DATABASE_URL_DEV) {
  throw new Error('DATABASE_URL_DEV is not set')
} else {
  console.log('DATABASE_URL_DEV is set', process.env.DATABASE_URL_DEV)
}

export default defineConfig({
  out: './drizzle',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_DEV!,
  },
})
