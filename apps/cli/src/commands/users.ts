import { command, positional, string } from "@drizzle-team/brocli";
import { makeRequest } from "../utils/request.js";

export const users = command({
    name: "users",
    description: "User API test commands",
    handler: () => {
        console.log("Available subcommands: list, get, create, update, delete");
    },
    subcommands: [
        command({
            name: "list",
            description: "Get all users",
            options: {
                apiKey: string("--api-key").desc("API key for authorization"),
                token: string("--token").desc("JWT token for authorization"),
            },
            handler: async (opts) => {
                const res = await makeRequest("GET", "/users", opts);
                console.log(JSON.stringify(res, null, 2));
            },
        }),

        command({
            name: "get",
            description: "Get user by ID",
            options: {
                id: positional("id").desc("User ID").required(),
                apiKey: string("--api-key").desc("API key"),
                token: string("--token").desc("JWT token"),
            },
            handler: async (opts) => {
                const res = await makeRequest("GET", `/users/${opts.id}`, opts);
                console.log(JSON.stringify(res, null, 2));
            },
        }),

        command({
            name: "create",
            description: "Create user",
            options: {
                apiKey: string("--api-key").desc("API key"),
                token: string("--token").desc("JWT token"),
                firstName: string("--first-name").desc("First name"),
                lastName: string("--last-name").desc("Last name"),
                city: string("--city").desc("City"),
                email: string("--email").desc("Email"),
                primaryEmail: string("--primary-email").desc("Primary Email"),
            },
            handler: async (opts) => {
                const emailList = Array.isArray(opts.email) ? opts.email : opts.email ? [opts.email] : [];

                const emails = emailList.map((address: string) => ({
                    email: address,
                    isPrimary: address === opts.primaryEmail,
                }));

                const body = Object.fromEntries(
                    Object.entries({
                        firstName: opts.firstName,
                        lastName: opts.lastName,
                        city: opts.city,
                        emails,
                    }).filter(([_, v]) => v !== undefined)
                );

                const res = await makeRequest("POST", "/users", { ...opts, body });
                console.log(JSON.stringify(res, null, 2));
            },
        }),

        command({
            name: "update",
            description: "Update user by ID",
            options: {
                apiKey: string("--api-key").desc("API key"),
                token: string("--token").desc("JWT token"),
                id: positional("id").desc("User ID").required(),
                firstName: string("--first-name").desc("First name"),
                lastName: string("--last-name").desc("Last name"),
                city: string("--city").desc("City"),
                email: string("--email").desc("Email (can be multiple)"),
                primaryEmail: string("--primary-email").desc("Primary Email"),
            },
            handler: async (opts) => {
                const emailList = Array.isArray(opts.email)
                    ? opts.email
                    : opts.email
                        ? [opts.email]
                        : [];

                const emails =
                    emailList.length > 0
                        ? emailList.map((address: string) => ({
                            email: address,
                            isPrimary: address === opts.primaryEmail ? true : false,
                        }))
                        : undefined;

                const body = Object.fromEntries(
                    Object.entries({
                        firstName: opts.firstName,
                        lastName: opts.lastName,
                        city: opts.city,
                        emails,
                    }).filter(([, v]) => v !== undefined)
                );

                const res = await makeRequest("PUT", `/users/${opts.id}`, { ...opts, body });
                console.log("✅ User updated successfully:");
                console.log(JSON.stringify(res, null, 2));
            },
        }),

        command({
            name: "delete",
            description: "Delete user by ID",
            options: {
                apiKey: string("--api-key").desc("API key"),
                token: string("--token").desc("JWT token"),
                id: positional("id").desc("User ID").required(),
            },
            handler: async (opts) => {
                try {
                    const res = await makeRequest("DELETE", `/users/${opts.id}`, opts);
                    console.log("🗑️  User deleted successfully:");
                    console.log(JSON.stringify(res, null, 2));
                } catch (err: any) {
                    console.error("❌ Error deleting user:", err.message);
                }
            },
        }),
    ],
});