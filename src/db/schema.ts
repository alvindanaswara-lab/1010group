import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table using Firebase Auth UID as unique identifier
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  username: text('username').notNull(),
  email: text('email').notNull(),
  position: text('position').notNull().default('Outlet'),
  placement: text('placement'),
  outletName: text('outlet_name'),
  department: text('department'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define 'app_state_records' table for persisting supply chain application state in Cloud SQL
export const appStateRecords = pgTable('app_state_records', {
  id: serial('id').primaryKey(),
  stateKey: text('state_key').notNull().unique(),
  stateJson: text('state_json').notNull(),
  updatedByUid: text('updated_by_uid'),
  userId: integer('user_id').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  stateRecords: many(appStateRecords),
}));

export const appStateRecordsRelations = relations(appStateRecords, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [appStateRecords.userId],
    references: [users.id],
  }),
}));
