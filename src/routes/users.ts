import { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { users, usersEmails } from "../db/schema";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import logger from "../utils/logger";
import { paginationSchema, idSchema, UserSchema, UserUpdateSchema } from "../types";


export default async function usersRoutes(app: FastifyInstance) {
  // ---- GET ALL USERS ----
  app.get("/", async (req, reply) => {
    try {

      const { limit, offset } = paginationSchema.parse(req.query);

      const result = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .limit(limit)
        .offset(offset)
        .all();

      return reply.send(result);
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn("GET /users - Validation error", { error: error.format() });
        return reply.code(400).send({ error: "Invalid query parameters", details: error.format() });
      }
      logger.error("GET /users - Error fetching users", { error: (error as any).message, stack: (error as any).stack });
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to fetch users"
      });
    }
  });

  // ---- GET USER BY ID ----
  app.get("/:id", async (req, reply) => {
    try {
      const { id: userId } = idSchema.parse(req.params);

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .get();

      if (!user) {
        logger.warn(`GET /users/:id - User not found with ID: ${userId}`);
        return reply.code(404).send({ error: "User not found" });
      }

      const emails = await db
        .select({
          email: usersEmails.email,
          isPrimary: usersEmails.isPrimary,
        })
        .from(usersEmails)
        .where(eq(usersEmails.userId, userId))
        .all();

      return reply.send({ ...user, emails });
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn("GET /users/:id - Validation error", { error: error.format() });
        return reply.code(400).send({ error: "Invalid user ID format", details: error.format() });
      }
      logger.error("GET /users/:id - Error fetching user", { error: (error as any).message, stack: (error as any).stack });
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to fetch user"
      });
    }
  });

  // ---- CREATE USER ----
  app.post("/", async (req, reply) => {
    try {

      const { firstName, lastName, city, emails } = UserSchema.parse(req.body);

      const newUser = await db
        .insert(users)
        .values({ firstName, lastName, city })
        .returning({ id: users.id })
        .get();

      if (emails && emails.length > 0) {
        await db.insert(usersEmails).values(
          emails.map((email) => ({
            userId: newUser.id,
            email: email.email,
            isPrimary: email.isPrimary ?? false,
          }))
        ).run();
      }

      logger.info(`POST /users - Successfully created user with ID: ${newUser.id}`);
      return reply.code(201).send({
        message: "User created successfully",
        user: { id: newUser.id, firstName, lastName, city, emails },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn("POST /users - Validation error", { error: error.format() });
        return reply.code(400).send({ error: "Invalid request body", details: error.format() });
      }
      logger.error("POST /users - Error creating user", { error: (error as any).message, stack: (error as any).stack });
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to create user"
      });
    }
  });

  // ---- UPDATE USER ----
  app.put("/:id", async (req, reply) => {
    try {
      const { id: userId } = idSchema.parse(req.params);

      const { firstName, lastName, city, emails } = UserUpdateSchema.parse(req.body);

      const result = await db
        .update(users)
        .set({
          firstName,
          lastName,
          city,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .run();

      if (result.changes === 0) {
        logger.warn(`PUT /users/:id - User not found with ID: ${userId}`);
        return reply.code(404).send({ error: "User not found" });
      }

      if (emails) {
        await db.transaction(async (tx) => {
          await tx.delete(usersEmails).where(eq(usersEmails.userId, userId)).run();

          if (emails.length > 0) {
            await tx
              .insert(usersEmails)
              .values(
                emails.map((e) => ({
                  userId,
                  email: e.email,
                  isPrimary: e.isPrimary ?? false,
                }))
              ).run();
          }
        });
      }

      const updated = await db.select().from(users).where(eq(users.id, userId)).get();

      logger.info(`PUT /users/:id - Successfully updated user with ID: ${userId}`);
      return reply.send({
        message: "User updated successfully",
        user: { ...updated },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn("PUT /users/:id - Validation error", { error: error.format() });
        return reply.code(400).send({ error: "Invalid body data", details: error.format() });
      }
      logger.error("PUT /users/:id - Error updating user", { error: (error as any).message, stack: (error as any).stack });
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to update user"
      });
    }
  });

  // ---- DELETE USER ----
  app.delete("/:id", async (req, reply) => {
    try {
      const { id: userId } = idSchema.parse(req.params);

      await db.transaction(async (tx) => {

        await tx.delete(usersEmails).where(eq(usersEmails.userId, userId)).run();

        const result = await tx.delete(users).where(eq(users.id, userId)).run();

        if (result.changes === 0) {
          logger.warn(`DELETE /users/:id - User not found with ID: ${userId}`);
          throw new Error("User not found");
        }
      });

      logger.info(`DELETE /users/:id - Successfully deleted user with ID: ${userId}`);
      return reply.send({
        message: `User (id: ${userId}) and related emails deleted successfully.`,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn("DELETE /users/:id - Validation error", { error: error.format() });
        return reply.code(400).send({ error: "Invalid user ID format", details: error.format() });
      }
      logger.error("DELETE /users/:id - Error deleting user", { error: (error as any).message, stack: (error as any).stack });
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to delete user"
      });
    }
  });
}
