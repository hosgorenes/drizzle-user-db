import "fastify";
export { };

declare module "fastify" {
    export interface FastifyRequest {
        user?: {
            id?: string | number;
            email?: string;
            role?: "anonymous" | "user" | "admin";
            authType?: "apiKey" | "jwt";
            [key: string]: any;
        };
    }
}