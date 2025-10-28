import { FastifyInstance } from "fastify";
import usersRoutes from "./users";

export default async function routes(app: FastifyInstance) {
    app.register(usersRoutes, { prefix: "/users" });
}