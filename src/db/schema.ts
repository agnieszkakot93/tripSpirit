import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Auth.js `@auth/d1-adapter` core tables (see `node_modules/@auth/d1-adapter/migrations.js`).
 * Column names match the adapter SQL (camelCase in SQLite).
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  /** Scrypt hash for Credentials provider (Phase 4); nullable until account exists. */
  passwordHash: text("password_hash"),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
  oauth_token_secret: text("oauth_token_secret"),
  oauth_token: text("oauth_token"),
});

/** Adapter uses `sessionToken` as the primary key. */
export const sessions = sqliteTable("sessions", {
  id: text("id").notNull(),
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

/** Adapter uses `token` alone as the primary key (matches upstream `upSQLStatements`). */
export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").primaryKey(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

/** Saved trip + persisted itinerary JSON (FR-004–FR-012). */
export const trips = sqliteTable(
  "trips",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    destination: text("destination").notNull(),
    durationDays: integer("duration_days").notNull(),
    /** Whole currency units (product convention); adjust if you need cents. */
    budgetAmount: integer("budget_amount").notNull(),
    itineraryJson: text("itinerary_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("trips_user_idx").on(t.userId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  trips: many(trips),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const tripsRelations = relations(trips, ({ one }) => ({
  user: one(users, { fields: [trips.userId], references: [users.id] }),
}));
