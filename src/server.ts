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


app.get("/user/:id", async (request, reply) => {

    const idSchema = z.object({ id: z.string().cuid2() });
    const parseResult = idSchema.safeParse(request.params);

    if (!parseResult.success) {
        return reply.code(400).send({
            error: "Invalid user ID format",
            details: parseResult.error.format(),
        });
    }

    const { id: userId } = parseResult.data;

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


const newUser = db
    .insert(users)
    .values({
        firstName: "Cem",
        lastName: "Gürkaş",
        city: "İzmir",
    })
    .returning({ id: users.id })
    .get();

await db.insert(usersEmails).values({
    userId: newUser.id,
    email: "cemenes@example.com",
    isPrimary: true,
});

app.listen({ port: 3000 }, (err, address) => {
    if (err) throw err;
    console.log(`Server ${address} adresinde çalışıyor`);
});
