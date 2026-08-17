"use strict";

const STATE_ID = process.env.SCHEDULER_STATE_ID || "main";

const defaultState = {
    managerCode: "MANAGER2026",
    employees: [
        { id: "emp-alex", name: "Alex Morgan", role: "Front desk", code: "ALEX101", color: "#007aff" },
        { id: "emp-mia", name: "Mia Chen", role: "Service", code: "MIA204", color: "#34c759" },
        { id: "emp-noah", name: "Noah Pop", role: "Support", code: "NOAH315", color: "#ff9500" }
    ],
    availability: {},
    shifts: {}
};

module.exports = async function handler(request, response) {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");

    if (request.method === "OPTIONS") {
        response.status(204).end();
        return;
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        response.status(503).json({
            error: "Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        });
        return;
    }

    try {
        if (request.method === "GET") {
            const rows = await supabaseFetch(`scheduler_state?id=eq.${encodeURIComponent(STATE_ID)}&select=data,updated_at`, {
                method: "GET"
            });
            response.status(200).json({
                data: rows[0] ? rows[0].data : defaultState,
                updatedAt: rows[0] ? rows[0].updated_at : null
            });
            return;
        }

        if (request.method === "POST" || request.method === "PUT") {
            const body = await readJsonBody(request);
            if (!body || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
                response.status(400).json({ error: "Expected JSON body: { data: object }" });
                return;
            }

            const rows = await supabaseFetch("scheduler_state?on_conflict=id", {
                method: "POST",
                headers: { Prefer: "resolution=merge-duplicates,return=representation" },
                body: JSON.stringify([{ id: STATE_ID, data: body.data }])
            });
            response.status(200).json({
                data: rows[0] ? rows[0].data : body.data,
                updatedAt: rows[0] ? rows[0].updated_at : null
            });
            return;
        }

        response.setHeader("Allow", "GET, POST, PUT, OPTIONS");
        response.status(405).json({ error: "Method not allowed" });
    } catch (error) {
        response.status(500).json({ error: error.message || "Database request failed" });
    }
};

async function supabaseFetch(path, options) {
    const baseUrl = process.env.SUPABASE_URL.replace(/\/$/, "");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await fetch(`${baseUrl}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const text = await result.text();
    const json = text ? JSON.parse(text) : null;
    if (!result.ok) {
        throw new Error(json && json.message ? json.message : `Supabase request failed (${result.status})`);
    }
    return json || [];
}

function readJsonBody(request) {
    if (request.body) {
        if (typeof request.body === "string") return Promise.resolve(JSON.parse(request.body));
        return Promise.resolve(request.body);
    }

    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1_000_000) {
                reject(new Error("Request body is too large"));
                request.destroy();
            }
        });
        request.on("end", () => {
            if (!body) {
                resolve(null);
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error("Invalid JSON body"));
            }
        });
        request.on("error", reject);
    });
}
