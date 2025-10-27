import fetch from "node-fetch";

interface RequestOptions {
    token?: string;
    apiKey?: string;
    body?: any;
}

export async function makeRequest(
    method: string,
    endpoint: string,
    options: RequestOptions = {}
) {
    const baseUrl = process.env.API_URL || "http://localhost:3000";

    const headers: Record<string, string> = {};

    if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
    if (options.apiKey) headers["x-api-key"] = options.apiKey;
    if (options.body) headers["Content-Type"] = "application/json";

    const fetchOptions: any = {
        method,
        headers,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    };

    const res = await fetch(`${baseUrl}${endpoint}`, fetchOptions);

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }

    try {
        return await res.json();
    } catch {
        return { message: "No JSON response", status: res.status };
    }
}
