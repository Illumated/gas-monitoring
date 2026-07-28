"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const port = Number(process.env.AUTH_SERVICE_PORT || 8082);
const dataFile = process.env.AUTH_SERVICE_DATA_FILE || "/data/users.json";
const adminToken = String(process.env.AUTH_SERVICE_TOKEN || "");
const initialUser = String(process.env.REMOTE_INITIAL_USER || "").trim();
const initialPassword = String(process.env.REMOTE_INITIAL_PASSWORD || "");

if (!adminToken) {
    throw new Error("AUTH_SERVICE_TOKEN is required");
}

function derive(password, salt = crypto.randomBytes(16)) {
    const hash = crypto.scryptSync(password, salt, 64);
    return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verify(password, encoded) {
    const [algorithm, saltHex, hashHex] = String(encoded).split("$");
    if (algorithm !== "scrypt" || !/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(hashHex)) {
        return false;
    }
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return crypto.timingSafeEqual(actual, expected);
}

function normalizeUsername(value) {
    const username = String(value || "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
        throw new Error("Логин: 3–32 символа, латинские буквы, цифры, точка, дефис или подчёркивание");
    }
    return username;
}

function validatePassword(value) {
    const password = String(value || "");
    if (password.length < 10 || password.length > 128) {
        throw new Error("Пароль должен содержать от 10 до 128 символов");
    }
    return password;
}

function loadUsers() {
    if (!fs.existsSync(dataFile)) return [];
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    if (!Array.isArray(parsed.users)) throw new Error("Invalid auth users file");
    return parsed.users;
}

function saveUsers(users) {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true, mode: 0o700 });
    const temporary = `${dataFile}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, users }, null, 2) + "\n", { mode: 0o600 });
    fs.renameSync(temporary, dataFile);
}

let users = loadUsers();
if (!users.length && initialUser && initialPassword) {
    users = [{
        username: normalizeUsername(initialUser),
        passwordHash: derive(validatePassword(initialPassword)),
        createdAt: new Date().toISOString()
    }];
    saveUsers(users);
}
if (!users.length) {
    throw new Error("At least one initial remote user is required");
}

function json(response, statusCode, payload) {
    const body = JSON.stringify(payload);
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store"
    });
    response.end(body);
}

function authorizedAdmin(request) {
    const supplied = Buffer.from(String(request.headers["x-auth-admin-token"] || ""));
    const expected = Buffer.from(adminToken);
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function parseBasic(request) {
    const header = String(request.headers.authorization || "");
    if (!header.startsWith("Basic ")) return null;
    let decoded;
    try {
        decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    } catch {
        return null;
    }
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    return { username: decoded.slice(0, separator).trim().toLowerCase(), password: decoded.slice(separator + 1) };
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 16_384) request.destroy();
        });
        request.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });
        request.on("error", reject);
    });
}

const server = http.createServer(async (request, response) => {
    try {
        if (request.method === "GET" && request.url === "/health") {
            return json(response, 200, { status: "ok", users: users.length });
        }
        if (request.method === "GET" && request.url === "/verify") {
            const credentials = parseBasic(request);
            const user = credentials && users.find((item) => item.username === credentials.username);
            if (!user || !verify(credentials.password, user.passwordHash)) {
                response.writeHead(401, { "WWW-Authenticate": 'Basic realm="RINIR monitoring"', "Cache-Control": "no-store" });
                return response.end();
            }
            response.writeHead(204, { "X-Authenticated-User": user.username, "Cache-Control": "no-store" });
            return response.end();
        }
        if (!authorizedAdmin(request)) {
            return json(response, 403, { error: "Forbidden" });
        }
        if (request.method === "GET" && request.url === "/users") {
            return json(response, 200, {
                users: users.map(({ username, createdAt }) => ({ username, createdAt }))
            });
        }
        if (request.method === "POST" && request.url === "/users") {
            const body = await readBody(request);
            const username = normalizeUsername(body.username);
            const password = validatePassword(body.password);
            if (users.some((item) => item.username === username)) {
                return json(response, 409, { error: "Пользователь уже существует" });
            }
            users.push({ username, passwordHash: derive(password), createdAt: new Date().toISOString() });
            saveUsers(users);
            return json(response, 201, { users: users.map(({ username, createdAt }) => ({ username, createdAt })) });
        }
        if (request.method === "DELETE" && request.url.startsWith("/users/")) {
            const username = normalizeUsername(decodeURIComponent(request.url.slice("/users/".length)));
            if (users.length === 1) {
                return json(response, 409, { error: "Нельзя удалить последнего удалённого пользователя" });
            }
            const next = users.filter((item) => item.username !== username);
            if (next.length === users.length) {
                return json(response, 404, { error: "Пользователь не найден" });
            }
            users = next;
            saveUsers(users);
            return json(response, 200, { users: users.map(({ username, createdAt }) => ({ username, createdAt })) });
        }
        return json(response, 404, { error: "Not found" });
    } catch (error) {
        return json(response, 400, { error: error.message || "Invalid request" });
    }
});

server.listen(port, "0.0.0.0", () => {
    process.stdout.write(`Auth service listening on ${server.address().port}\n`);
});
