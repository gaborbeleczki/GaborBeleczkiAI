import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * One table for every trackable thing (school todo, home todo, reminder, event,
 * assessment, money request, bill, reading item, podcast). Views filter by `type` / `area`.
 * Dates are stored as local Europe/Budapest calendar strings (YYYY-MM-DD / HH:MM),
 * which is how teachers and invoices express them.
 */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(), // task | event | reminder | assessment | payment | bill | reading | podcast
    area: text("area").notNull().default("home"), // school | home | finance | personal | media
    title: text("title").notNull(),
    details: text("details"),
    kidIds: text("kid_ids").array().notNull().default([]),
    category: text("category"),
    subject: text("subject"),
    assessmentKind: text("assessment_kind"),
    topics: text("topics"),
    date: text("date"),
    time: text("time"),
    endDate: text("end_date"),
    endTime: text("end_time"),
    datePrecision: text("date_precision").notNull().default("exact"), // exact | week | month | unknown
    status: text("status").notNull().default("open"), // open | waiting | done | dismissed
    priority: text("priority").notNull().default("normal"),
    needsReview: boolean("needs_review").notNull().default(false),
    confidence: real("confidence"),
    estimateMinutes: real("estimate_minutes"),
    amount: doublePrecision("amount"),
    currency: text("currency"),
    payee: text("payee"),
    paymentInfo: jsonb("payment_info").$type<PaymentInfo>(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    url: text("url"),
    source: text("source").notNull().default("manual"), // email | manual | ai
    sourceEmailId: text("source_email_id"),
    sourceContact: text("source_contact"),
    sourceQuote: text("source_quote"),
    meta: jsonb("meta").$type<ItemMeta>().notNull().default({}),
    calendarEventId: text("calendar_event_id"),
    calendarPrepIds: jsonb("calendar_prep_ids").$type<string[]>().notNull().default([]),
    calendarSyncedAt: timestamp("calendar_synced_at", { withTimezone: true }),
    calendarError: text("calendar_error"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("items_type_status_idx").on(t.type, t.status),
    index("items_date_idx").on(t.date),
    index("items_source_email_idx").on(t.sourceEmailId),
  ],
);

export type PaymentInfo = {
  account?: string | null;
  reference?: string | null;
  invoiceNumber?: string | null;
  method?: string | null;
};

export type ItemMeta = {
  calendarDate?: string; // date the calendar events were computed for
  calendarKey?: string; // hash of fields that affect calendar placement
  readingSource?: string;
  minutes?: number;
  why?: string;
  show?: string;
  episodeTitle?: string;
  spotifyQuery?: string;
  spotifyUri?: string;
  spotifyAddedAt?: string;
  worthy?: boolean;
  emailIds?: string[];
  history?: { at: string; note: string }[];
  [k: string]: unknown;
};

export const emails = pgTable(
  "emails",
  {
    id: text("id").primaryKey(), // Gmail message id
    threadId: text("thread_id"),
    fromEmail: text("from_email"),
    fromName: text("from_name"),
    toEmails: text("to_emails").array().notNull().default([]),
    subject: text("subject"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    snippet: text("snippet"),
    excerpt: text("excerpt"),
    labels: text("labels").array().notNull().default([]),
    category: text("category"),
    kidIds: text("kid_ids").array().notNull().default([]),
    status: text("status").notNull().default("pending"), // pending | processed | skipped | error
    summary: text("summary"),
    attachments: jsonb("attachments").$type<{ filename: string; mimeType: string }[]>().notNull().default([]),
    links: jsonb("links").$type<{ text: string; href: string }[]>().notNull().default([]),
    itemIds: text("item_ids").array().notNull().default([]),
    ai: jsonb("ai"),
    error: text("error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("emails_received_idx").on(t.receivedAt), index("emails_category_idx").on(t.category)],
);

export const digests = pgTable("digests", {
  date: text("date").primaryKey(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthTokens = pgTable("oauth_tokens", {
  provider: text("provider").primaryKey(), // google | spotify
  account: text("account"),
  refreshToken: text("refresh_token"), // encrypted
  accessToken: text("access_token"), // encrypted
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scope: text("scope"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  trigger: text("trigger"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  stats: jsonb("stats"),
  error: text("error"),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Email = typeof emails.$inferSelect;
