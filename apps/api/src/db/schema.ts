import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const users = sqliteTable("users", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    city: text("city"),
    createdAt: text("created_at")
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const usersEmails = sqliteTable("users_emails", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" })
        .default(false)
        .notNull(),
    createdAt: text("created_at")
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: text("updated_at"),
});