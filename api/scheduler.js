"use strict";

const STATE_ID = process.env.SCHEDULER_STATE_ID || "main";
const STATE_PATH = `scheduler/${STATE_ID}.json`;

const defaultState = {
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

    try {
        const { get, put } = await import("@vercel/blob");

        if (request.method === "GET") {
            const saved = await readSchedulerState(get);
            response.status(200).json({
                data: saved ? saved.data : defaultState,
                updatedAt: saved ? saved.updatedAt : null
            });
            return;
        }

        if (request.method === "POST" || request.method === "PUT") {
            const body = await readJsonBody(request);
            if (!body || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
                response.status(400).json({ error: "Expected JSON body: { data: object }" });
                return;
            }

            const saved = {
                data: normalizeState(body.data),
                updatedAt: new Date().toISOString()
            };
            await put(STATE_PATH, JSON.stringify(saved), {
                access: "private",
                allowOverwrite: true,
                contentType: "application/json"
            });
            response.status(200).json({
                data: saved.data,
                updatedAt: saved.updatedAt
            });
            return;
        }

        response.setHeader("Allow", "GET, POST, PUT, OPTIONS");
        response.status(405).json({ error: "Method not allowed" });
    } catch (error) {
        const message = error.message || "Blob storage request failed";
        const status = /No blob credentials/i.test(message) ? 503 : 500;
        response.status(status).json({ error: message });
    }
};

async function readSchedulerState(get) {
    try {
        const result = await get(STATE_PATH, { access: "private", useCache: false });
        if (!result || result.statusCode === 404) return null;
        if (result.statusCode && result.statusCode >= 400) {
            throw new Error(`Blob read failed (${result.statusCode})`);
        }

        const text = await streamToText(result.stream);
        const parsed = text ? JSON.parse(text) : null;
        if (parsed && parsed.data) {
            return {
                data: normalizeState(parsed.data),
                updatedAt: parsed.updatedAt || null
            };
        }
        return null;
    } catch (error) {
        if (error && /not found/i.test(error.message || "")) return null;
        throw error;
    }
}

function normalizeState(nextState) {
    const normalizedState = {
        ...defaultState,
        ...(nextState || {}),
        employees: Array.isArray(nextState && nextState.employees) ? nextState.employees : defaultState.employees,
        availability: nextState && nextState.availability ? nextState.availability : {},
        shifts: nextState && nextState.shifts ? nextState.shifts : {}
    };
    delete normalizedState.managerCode;
    delete normalizedState.managerCodes;
    return normalizedState;
}

async function streamToText(stream) {
    if (!stream) return "";
    const response = new Response(stream);
    return response.text();
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
