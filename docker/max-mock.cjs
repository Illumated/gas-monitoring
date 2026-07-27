"use strict";

const http = require("node:http");

const messages = [];
let failedRequestsRemaining = 0;

function json(response, status, body) {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
        json(response, 200, { status: "pass", messages: messages.length, failedRequestsRemaining });
        return;
    }
    if (request.method === "GET" && request.url === "/messages") {
        json(response, 200, { messages });
        return;
    }
    const failMatch = request.method === "POST" && request.url?.match(/^\/fail\/([0-9]+)$/);
    if (failMatch) {
        failedRequestsRemaining = Number(failMatch[1]);
        json(response, 200, { failedRequestsRemaining });
        return;
    }
    if (request.method === "DELETE" && request.url === "/messages") {
        messages.length = 0;
        failedRequestsRemaining = 0;
        json(response, 200, { status: "cleared" });
        return;
    }
    if (request.method === "POST" && request.url?.startsWith("/messages?")) {
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => { body += chunk; });
        request.on("end", () => {
            if (failedRequestsRemaining > 0) {
                failedRequestsRemaining -= 1;
                json(response, 500, { error: "planned mock failure", failedRequestsRemaining });
                return;
            }
            let payload;
            try {
                payload = JSON.parse(body);
            } catch {
                json(response, 400, { error: "invalid JSON" });
                return;
            }
            messages.push({
                receivedUtc: new Date().toISOString(),
                authorization: request.headers.authorization || null,
                chatId: new URL(request.url, "http://localhost").searchParams.get("chat_id"),
                payload
            });
            json(response, 200, { message: { body: { mid: `mock-${messages.length}` } } });
        });
        return;
    }
    json(response, 404, { error: "unknown endpoint" });
});

server.listen(8081, "0.0.0.0");

function shutdown() {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
