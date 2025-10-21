import Fastify from "fastify";
import { db } from "./db/client";
import { users, usersEmails } from "./db/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";

const app = Fastify();

const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    offset: z.coerce.number().int().min(0).default(0),
});

// ---- GET ALL USERS ----

app.get("/users", async (req, reply) => {
    const parseResult = paginationSchema.safeParse(req.query);

    if (!parseResult.success) {
        return reply.code(400).send({
            error: "Invalid query parameters",
            details: parseResult.error.format(),
        });
    }

    const { limit, offset } = parseResult.data;

    const result = db
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
});

// ---- GET USER BY ID ----

app.get("/user/:id", async (request, reply) => {

    const idSchema = z.object({ id: z.string().cuid2() });
    const idResult = idSchema.safeParse(request.params);

    if (!idResult.success) {
        return reply.code(400).send({
            error: "Invalid user ID format",
            details: idResult.error.format(),
        });
    }

    const { id: userId } = idResult.data;

    //Kullanıcıyı veritabanından çek
    const user = db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .get();

    if (!user) {
        return reply.code(404).send({ error: "User not found" });
    }

    //E-postalarını getir
    const emails = db
        .select({
            email: usersEmails.email,
            isPrimary: usersEmails.isPrimary,
        })
        .from(usersEmails)
        .where(eq(usersEmails.userId, userId))
        .all();

    //Sonucu döndür
    return reply.send({
        ...user,
        emails,
    });
});


// ---- CREATE USER ----

app.post("/users", async (req, reply) => {
    const createUserSchema = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        city: z.string().optional(),
        emails: z.array(z.object({
            email: z.string().email(),
            isPrimary: z.boolean().default(false),
        })),
    });

    const parseResult = createUserSchema.safeParse(req.body);

    if (!parseResult.success) {
        return reply.code(400).send({
            error: "Invalid request body",
            details: parseResult.error.format(),
        });
    }
    const { firstName, lastName, city, emails } = parseResult.data;

    const newUser = db
        .insert(users)
        .values({
            firstName,
            lastName,
            city,
        })
        .returning({ id: users.id })
        .get();

    await db.insert(usersEmails).values(emails.map(email => ({
        userId: newUser.id,
        email: email.email,
        isPrimary: email.isPrimary,
    })));

    return reply.code(201).send({
        message: "User created successfully",
        user: {
            id: newUser.id,
            firstName,
            lastName,
            city,
            emails,
        },
    });
});

// ---- UPDATE USER ----

app.put("/user/:id", async (req, reply) => {
    const idSchema = z.object({ id: z.string().cuid2() });
    const idResult = idSchema.safeParse(req.params);

    // ID doğrulaması
    if (!idResult.success) {
        return reply.code(400).send({
            error: "Invalid user ID format",
            details: idResult.error.format(),
        });
    }

    const userId = idResult.data.id;

    // Body doğrulaması
    const updateUserSchema = z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        city: z.string().optional(),
        emails: z.array(z.object({
            email: z.string().email(),
            isPrimary: z.boolean().default(false),
        })).optional(),
    });

    const parseResult = updateUserSchema.safeParse(req.body);

    if (!parseResult.success) {
        return reply.code(400).send({
            error: "Invalid body data",
            details: parseResult.error.format(),
        });
    }

    const { firstName, lastName, city, emails } = parseResult.data;

    const [existing] = await db.select().from(users).where(eq(users.id, userId));
    if (!existing) {
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
        .where(eq(users.id, userId));

    if (emails) {
        await db.delete(usersEmails).where(eq(usersEmails.userId, userId));
        await db.insert(usersEmails).values(
            emails.map((e) => ({
                userId,
                email: e.email,
                isPrimary: e.isPrimary
            }))
        );
    }

    const [updated] = await db.select().from(users).where(eq(users.id, userId));

    return reply.send({
        message: "User updated successfully",
        user: { ...updated },
    });
});

// ---- DELETE USER ----

app.delete("/user/:id", async (req, reply) => {

    const idSchema = z.object({ id: z.string().cuid2() });
    const idResult = idSchema.safeParse(req.params);

    //ID doğrulaması
    if (!idResult.success) {
        return reply.code(400).send({
            error: "Invalid user ID format",
            details: idResult.error.format(),
        });
    }

    const userId = idResult.data.id;

    const [existing] = await db.select().from(users).where(eq(users.id, userId))

    if (!existing) {
        return reply.code(404).send({ error: "User not found" });
    }

    await db.delete(usersEmails).where(eq(usersEmails.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    return reply.send({
        message: `User (id: ${userId}) and related emails deleted successfully.`,
    });
})


app.listen({ port: 3000 }, (err, address) => {
    if (err) throw err;
    console.log(`Server ${address} adresinde çalışıyor`);
});
