import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const api = pgSchema('api')

/** One App Store Connect API key per user; used to list apps and link connected apps */
export const ascApiKeys = api.table(
  'asc_api_keys',
  {
    id: serial().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    issuerId: text('issuer_id').notNull(),
    keyId: text('key_id').notNull(),
    encryptedPrivateKey: text('encrypted_private_key').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index().on(t.userId),
    uniqueIndex('asc_api_keys_user_id_unique').on(t.userId),
  ],
)

export const githubInstallations = api.table(
  'github_installations',
  {
    id: serial().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    githubInstallationId: text('github_installation_id').notNull(),
    accountLogin: text('account_login').notNull(),
    accountType: text('account_type').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('github_installations_user_id_index').on(t.userId),
    uniqueIndex('github_installations_user_installation_unique').on(
      t.userId,
      t.githubInstallationId,
    ),
  ],
)

export const connectedApps = api.table(
  'connected_apps',
  {
    id: serial().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** When set, use this key for API calls; else use legacy per-row key fields */
    ascKeyId: integer('asc_key_id').references(() => ascApiKeys.id, {
      onDelete: 'set null',
    }),
    appStoreAppId: text('app_store_app_id'),
    name: text('name'),
    bundleId: text('bundle_id'),
    issuerId: text('issuer_id'),
    keyId: text('key_id'),
    encryptedPrivateKey: text('encrypted_private_key'),
    githubInstallationId: text('github_installation_id'),
    githubRepoFullName: text('github_repo_full_name'),
    githubRepoOwner: text('github_repo_owner'),
    githubRepoName: text('github_repo_name'),
    watchedBranch: text('watched_branch'),
    automationLocales: jsonb('automation_locales').$type<string[]>(),
    automationActivatedAt: timestamp('automation_activated_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index().on(t.userId),
    index().on(t.ascKeyId),
    index('connected_apps_github_installation_id_index').on(t.githubInstallationId),
  ],
)

export const releaseTimelineEvents = api.table(
  'release_timeline_events',
  {
    id: serial().primaryKey(),
    connectedAppId: integer('connected_app_id')
      .notNull()
      .references(() => connectedApps.id, { onDelete: 'cascade' }),
    versionId: text('version_id').notNull(),
    eventType: text('event_type').notNull(),
    detail: text('detail'),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('release_timeline_events_connected_app_id_index').on(t.connectedAppId),
    index('release_timeline_events_version_id_index').on(t.versionId),
    index('release_timeline_events_event_type_index').on(t.eventType),
  ],
)

export const user = api.table(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_email_unique').on(t.email)],
)

export const session = api.table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('session_token_unique').on(t.token),
    index('session_user_id_index').on(t.userId),
  ],
)

export const account = api.table(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('account_user_id_index').on(t.userId),
    uniqueIndex('account_provider_account_unique').on(t.providerId, t.accountId),
  ],
)

export const verification = api.table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_index').on(t.identifier)],
)
