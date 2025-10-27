import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import "../types/fastify.d.ts";

export async function authenticationMiddleware(
    req: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const API_KEY = process.env.API_KEY!;
        const JWT_SECRET = process.env.JWT_SECRET!;

        const apiKey = req.headers["x-api-key"];
        if (apiKey) {
            if (apiKey === API_KEY) {
                req.user = { authType: "apiKey" };
                return;
            } else {
                return reply.code(401).send({
                    error: "Unauthorized",
                    message: "Invalid API key"
                });
            }
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return reply.code(401).send({
                error: "Unauthorized",
                message: "API key or Bearer token is required"
            });
        }

        const token = authHeader.replace("Bearer ", "");
        if (!token) {
            return reply.code(401).send({
                error: "Unauthorized",
                message: "JWT token is missing"
            });
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            req.user = {
                ...decoded,
                authType: "jwt"
            };
            return;
        } catch (jwtError) {
            return reply.code(401).send({
                error: "Unauthorized",
                message: "Invalid or expired JWT token"
            });
        }

    } catch (error) {
        return reply.code(500).send({
            error: "Internal Server Error",
            message: "Authentication failed"
        });
    }
}