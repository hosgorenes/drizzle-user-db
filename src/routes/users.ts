import { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { users, usersEmails } from "../db/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";
import logger from "../utils/logger";


export default async function usersRoutes(app: FastifyInstance) {

  const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    offset: z.coerce.number().int().min(0).default(0),
  });

  // ---- GET ALL USERS ----
  app.get("/", async (req, reply) => {
    try {
      logger.info("GET /users - Fetching all users");

      const parseResult = paginationSchema.safeParse(req.query);

      if (!parseResult.success) {
        logger.warn("GET /users - Invalid query parameters", { error: parseResult.error.format() });
        return reply.code(400).send({
          error: "Invalid query parameters",
          details: parseResult.error.format(),
        });
      }

      const { limit, offset } = parseResult.data;

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

      logger.info(`GET /users - Successfully fetched ${result.length} users`);
      return reply.send(result);
    } catch (error) {
      logger.error("GET /users - Error fetching users", { error: error.message, stack: error.stack });
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to fetch users"
      });
    }
  });

  // ---- GET USER BY ID ----
  app.get("/:id", async (req, reply) => {
    try {
      const idSchema = z.object({ id: z.string().cuid2() });
      const idResult = idSchema.safeParse(req.params);

      if (!idResult.success) {
        logger.warn("GET /users/:id - Invalid user ID format", { error: idResult.error.format() });
        return reply.code(400).send({
          error: "Invalid user ID format",
          details: idResult.error.format(),
        });
      }

      const { id: userId } = idResult.data;
      logger.info(`GET /users/:id - Fetching user with ID: ${userId}`);

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

      logger.info(`GET /users/:id - Successfully fetched user with ${emails.length} emails`);
      return reply.send({ ...user, emails });
    } catch (error) {
      logger.error("GET /users/:id - Error fetching user", { error: error.message, stack: error.stack });
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to fetch user"
      });
    }
  });

  // ---- CREATE USER ----
  app.post("/", async (req, reply) => {
    try {
      logger.info("POST /users - Creating new user");

      const createUserSchema = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        city: z.string().optional(),
        emails: z.array(
          z.object({
            email: z.string().email(),
            isPrimary: z.boolean().default(false),
          })
        ),
      });

      const parseResult = createUserSchema.safeParse(req.body);

      if (!parseResult.success) {
        logger.warn("POST /users - Invalid request body", { error: parseResult.error.format() });
        return reply.code(400).send({
          error: "Invalid request body",
          details: parseResult.error.format(),
        });
      }

      const { firstName, lastName, city, emails } = parseResult.data;

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
      logger.error("POST /users - Error creating user", { error: error.message, stack: error.stack });
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to create user"
      });
    }
  });

  // ---- UPDATE USER ----
  app.put("/:id", async (req, reply) => {
    try {
      const idSchema = z.object({ id: z.string().cuid2() });
      const idResult = idSchema.safeParse(req.params);

      if (!idResult.success) {
        logger.warn("PUT /users/:id - Invalid user ID format", { error: idResult.error.format() });
        return reply.code(400).send({
          error: "Invalid user ID format",
          details: idResult.error.format(),
        });
      }

      const userId = idResult.data.id;
      logger.info(`PUT /users/:id - Updating user with ID: ${userId}`);

      const updateUserSchema = z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        city: z.string().optional(),
        emails: z
          .array(
            z.object({
              email: z.string().email(),
              isPrimary: z.boolean().default(false),
            })
          )
          .optional(),
      });

      const parseResult = updateUserSchema.safeParse(req.body);

      if (!parseResult.success) {
        logger.warn("PUT /users/:id - Invalid body data", { error: parseResult.error.format() });
        return reply.code(400).send({
          error: "Invalid body data",
          details: parseResult.error.format(),
        });
      }

      const { firstName, lastName, city, emails } = parseResult.data;

      const existing = await db.select().from(users).where(eq(users.id, userId)).get();
      if (!existing) {
        logger.warn(`PUT /users/:id - User not found with ID: ${userId}`);
        return reply.code(404).send({ error: "User not found" });
      }

      await db
        .update(users)
        .set({
          firstName,
          lastName,
          city,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .run();

      if (emails) {
        await db.delete(usersEmails).where(eq(usersEmails.userId, userId)).run();
        if (emails.length > 0) {
          await db.insert(usersEmails).values(
            emails.map((e) => ({
              userId,
              email: e.email,
              isPrimary: e.isPrimary ?? false,
            }))
          ).run();
        }
      }

      const updated = await db.select().from(users).where(eq(users.id, userId)).get();

      logger.info(`PUT /users/:id - Successfully updated user with ID: ${userId}`);
      return reply.send({
        message: "User updated successfully",
        user: { ...updated },
      });
    } catch (error) {
      logger.error("PUT /users/:id - Error updating user", { error: error.message, stack: error.stack });
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to update user"
      });
    }
  });

  // ---- DELETE USER ----
  app.delete("/:id", async (req, reply) => {
    try {
      const idSchema = z.object({ id: z.string().cuid2() });
      const idResult = idSchema.safeParse(req.params);

      if (!idResult.success) {
        logger.warn("DELETE /users/:id - Invalid user ID format", { error: idResult.error.format() });
        return reply.code(400).send({
          error: "Invalid user ID format",
          details: idResult.error.format(),
        });
      }

      const userId = idResult.data.id;
      logger.info(`DELETE /users/:id - Deleting user with ID: ${userId}`);

      const existing = await db.select().from(users).where(eq(users.id, userId)).get();

      if (!existing) {
        logger.warn(`DELETE /users/:id - User not found with ID: ${userId}`);
        return reply.code(404).send({ error: "User not found" });
      }

      await db.delete(usersEmails).where(eq(usersEmails.userId, userId)).run();
      await db.delete(users).where(eq(users.id, userId)).run();

      logger.info(`DELETE /users/:id - Successfully deleted user with ID: ${userId}`);
      return reply.send({
        message: `User (id: ${userId}) and related emails deleted successfully.`,
      });
    } catch (error) {
      logger.error("DELETE /users/:id - Error deleting user", { error: error.message, stack: error.stack });
      return reply.code(500).send({
        error: "Internal server error",
        message: "Failed to delete user"
      });
    }
  });
}
