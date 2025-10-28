import { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { users, usersEmails } from "../db/schema";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import logger from "../utils/logger";
import { paginationSchema, idSchema, UserSchema, UserUpdateSchema } from "../types";
import { authenticationMiddleware } from "../middleware/authenticationMiddleware";
import { requireReadUsers, requireUpdateUser, requireDeleteUser, requireCreateUser } from "../middleware/authorizationMiddleware";
import "../types/fastify.d.ts";
import { createUserAbilities, getSelectableFields, canViewEmails } from "../utils/abilities";


export default async function usersRoutes(app: FastifyInstance) {
    app.addHook('preHandler', authenticationMiddleware);

    // ---- GET /users ----
    app.get("/", { preHandler: [requireReadUsers] }, async (req, reply) => {
        try {
            const { limit, offset } = paginationSchema.parse(req.query);

            const abilities = createUserAbilities(req.user);
            if (!abilities.can('read', 'User')) {
                return reply.code(403).send({ error: "Forbidden" });
            }

            const selectableFields = getSelectableFields(req.user);

            const selectObject = {};
            selectableFields.forEach(field => {
                selectObject[field] = users[field];
            });

            const usersResult = await db
                .select(selectObject)
                .from(users)
                .limit(limit)
                .offset(offset)
                .all();

            if (canViewEmails(req.user)) {
                const result = await Promise.all(
                    usersResult.map(async (user: any) => {
                        const emails = await db
                            .select({
                                email: usersEmails.email,
                                isPrimary: usersEmails.isPrimary
                            })
                            .from(usersEmails)
                            .where(eq(usersEmails.userId, user.id))
                            .all();

                        return {
                            ...user,
                            userEmails: emails
                        };
                    })
                );

                return reply.send(result);
            }

            return reply.send(usersResult);

        } catch (error) {
            console.log("GET /users ERROR:", error);
            if (error instanceof ZodError) {
                logger.warn("GET /users - Validation error", { error: error.format() });
                return reply
                    .code(400)
                    .send({ error: "Invalid query parameters", details: error.format() });
            }

            logger.error("GET /users - Error fetching users", {
                error: (error as any).message,
                stack: (error as any).stack,
                user: req.user
            });
            return reply.code(500).send({
                error: "Internal server error",
                message: "Failed to fetch users",
            });
        }
    });

    // ---- GET USER BY ID ----
    app.get("/:id", { preHandler: [requireReadUsers] }, async (req, reply) => {
        try {
            const { id: userId } = idSchema.parse(req.params);

            const abilities = createUserAbilities(req.user);
            if (!abilities.can('read', 'User')) {
                return reply.code(403).send({ error: "Forbidden" });
            }

            const selectableFields = getSelectableFields(req.user);

            const selectObject = {};
            selectableFields.forEach(field => {
                selectObject[field] = users[field];
            });

            const user = await db
                .select(selectObject)
                .from(users)
                .where(eq(users.id, userId))
                .get();

            if (!user) {
                logger.warn(`GET /users/:id - User not found with ID: ${userId}`);
                return reply.code(404).send({ error: "User not found" });
            }

            if (canViewEmails(req.user)) {
                const emails = await db
                    .select({
                        email: usersEmails.email,
                        isPrimary: usersEmails.isPrimary,
                    })
                    .from(usersEmails)
                    .where(eq(usersEmails.userId, userId))
                    .all();

                return reply.send({ ...user, emails });
            }

            return reply.send(user);

        } catch (error) {
            if (error instanceof ZodError) {
                logger.warn("GET /users/:id - Validation error", { error: error.format() });
                return reply
                    .code(400)
                    .send({ error: "Invalid user ID format", details: error.format() });
            }

            logger.error("GET /users/:id - Error fetching user", {
                error: (error as any).message,
                stack: (error as any).stack,
            });
            return reply.code(500).send({
                error: "Internal server error",
                message: "Failed to fetch user",
            });
        }
    });


    // ---- CREATE USER ----
    app.post("/", { preHandler: [requireCreateUser] }, async (req, reply) => {
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

    // ---- PUT /users/:id ----
    app.put("/:id", { preHandler: [requireUpdateUser] }, async (req, reply) => {
        try {
            const { id: userId } = idSchema.parse(req.params);

            const abilities = createUserAbilities(req.user);
            if (!abilities.can('update', 'User')) {
                return reply.code(403).send({ error: "Forbidden" });
            }

            if (req.user?.role === "user" && req.user?.id !== userId) {
                return reply.code(403).send({ error: "You can only update your own record" });
            }

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

            try {
                await db.transaction(async (tx) => {
                    await tx.delete(usersEmails).where(eq(usersEmails.userId, userId)).run();

                    if (emails && Array.isArray(emails) && emails.length > 0) {
                        await tx
                            .insert(usersEmails)
                            .values(
                                emails.map((e) => ({
                                    userId,
                                    email: e.email,
                                    isPrimary: e.isPrimary ?? false,
                                }))
                            )
                            .run();
                    }
                });
            } catch (emailError) {
                logger.error("PUT /users/:id - Error updating emails", {
                    error: (emailError as any).message,
                    userId,
                });
            }

            const updated = await db
                .select()
                .from(users)
                .where(eq(users.id, userId))
                .get();

            logger.info(`PUT /users/:id - Successfully updated user with ID: ${userId}`);
            return reply.code(200).send({
                message: "User updated successfully",
                user: { ...updated },
            });
        } catch (error) {
            if (error instanceof ZodError) {
                logger.warn("PUT /users/:id - Validation error", { error: error.format() });
                return reply.code(400).send({
                    error: "Invalid body data",
                    details: error.format(),
                });
            }

            console.log("PUT /users/:id ERROR:", error);
            logger.error("PUT /users/:id - Error updating user", {
                error: (error as any).message,
                stack: (error as any).stack,
            });

            return reply.code(500).send({
                error: "Internal server error",
                message: "Failed to update user",
            });
        }
    });



    // ---- DELETE /users/:id ----
    app.delete("/:id", { preHandler: [requireDeleteUser] }, async (req, reply) => {
        try {
            const { id: userId } = idSchema.parse(req.params);

            const abilities = createUserAbilities(req.user);
            if (!abilities.can('delete', 'User')) {
                return reply.code(403).send({ error: "Forbidden" });
            }

            if (req.user?.role === 'user' && req.user?.id !== userId) {
                return reply.code(403).send({ error: "You can only delete your own record" });
            }


            await db.delete(usersEmails).where(eq(usersEmails.userId, userId)).run();

            const result = await db.delete(users).where(eq(users.id, userId)).run();

            if (!result || result.changes === 0) {
                logger.warn(`DELETE /users/:id - User not found with ID: ${userId}`);
                return reply.code(404).send({ error: "User not found" });
            }

            logger.info(`DELETE /users/:id - Successfully deleted user with ID: ${userId}`);
            return reply.code(200).send({
                message: `User (id: ${userId}) and related emails deleted successfully.`,
            });

        } catch (error) {
            console.log("DELETE /users/:id ERROR:", error);
            if (error instanceof ZodError) {
                logger.warn("DELETE /users/:id - Validation error", { error: error.format() });
                return reply.code(400).send({
                    error: "Invalid user ID format",
                    details: error.format(),
                });
            }

            logger.error("DELETE /users/:id - Error deleting user", {
                error: (error as any).message,
                stack: (error as any).stack,
                user: req.user
            });

            return reply.code(500).send({
                error: "Internal server error",
                message: "Failed to delete user",
            });
        }
    });

}