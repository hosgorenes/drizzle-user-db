import { FastifyRequest, FastifyReply } from "fastify";
import { createUserAbilities, Actions, Subjects } from "../utils/abilities";

export function requirePermission(action: string, subject: string) {
    return async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            if (!req.user) {
                return reply.code(401).send({
                    error: "Unauthorized",
                    message: "Authentication required"
                });
            }

            const abilities = createUserAbilities(req.user);

            //If there is a parameter (e.g. /users/:id) pass it to CASL
            const entity = (req.params as any)?.id ? { id: (req.params as any).id } : undefined;

            if (!abilities.can(action as Actions, subject as Subjects)) {
                return reply.code(403).send({
                    error: "Forbidden",
                    message: `You don't have permission to ${action} ${subject}`
                });
            }

            // Permission granted, continue
            return;

        } catch (error) {
            return reply.code(500).send({
                error: "Internal Server Error",
                message: "Authorization failed"
            });
        }
    };
}


// Specific permission checkers
export const requireReadUsers = requirePermission('read', 'User');
export const requireUpdateUser = requirePermission('update', 'User');
export const requireDeleteUser = requirePermission('delete', 'User');
export const requireCreateUser = requirePermission('create', 'User');
