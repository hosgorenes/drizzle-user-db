import { z } from "zod";

export const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    offset: z.coerce.number().int().min(0).default(0),
});

export const idSchema = z.object({ id: z.string().cuid2() });

export const EmailSchema = z.object({
    email: z.string().email(),
    isPrimary: z.boolean().default(false),
});

export const UserSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    city: z.string().optional(),
    emails: z.array(EmailSchema),
});

export type UserInput = z.infer<typeof UserSchema>;
export const UserUpdateSchema = UserSchema.partial();
export type UserUpdate = z.infer<typeof UserUpdateSchema>;