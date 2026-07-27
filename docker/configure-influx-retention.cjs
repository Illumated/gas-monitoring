"use strict";

const required = (name) => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
};

const durationSeconds = (value) => {
    const match = /^(\d+)(h|d|w)$/.exec(value);
    if (!match) {
        throw new Error("INFLUXDB_RETENTION must use h, d or w");
    }
    const multiplier = { h: 3600, d: 86400, w: 604800 }[match[2]];
    const seconds = Number(match[1]) * multiplier;
    if (!Number.isSafeInteger(seconds) || seconds < 3600) {
        throw new Error("INFLUXDB_RETENTION must be at least 1h");
    }
    return seconds;
};

async function main() {
    const baseUrl = required("INFLUXDB_URL").replace(/\/$/, "");
    const org = required("INFLUXDB_ORG");
    const bucketName = required("INFLUXDB_BUCKET");
    const token = required("INFLUXDB_TOKEN");
    const everySeconds = durationSeconds(required("INFLUXDB_RETENTION"));
    const headers = { Authorization: `Token ${token}`, "Content-Type": "application/json" };

    const listResponse = await fetch(
        `${baseUrl}/api/v2/buckets?name=${encodeURIComponent(bucketName)}&org=${encodeURIComponent(org)}`,
        { headers }
    );
    if (!listResponse.ok) {
        throw new Error(`InfluxDB bucket lookup failed: HTTP ${listResponse.status}`);
    }
    const buckets = (await listResponse.json()).buckets || [];
    const bucket = buckets.find((candidate) => candidate.name === bucketName);
    if (!bucket) {
        throw new Error(`InfluxDB bucket not found: ${bucketName}`);
    }

    const currentSeconds = bucket.retentionRules?.[0]?.everySeconds ?? 0;
    if (currentSeconds !== everySeconds) {
        const updateResponse = await fetch(`${baseUrl}/api/v2/buckets/${encodeURIComponent(bucket.id)}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ retentionRules: [{ type: "expire", everySeconds }] })
        });
        if (!updateResponse.ok) {
            throw new Error(`InfluxDB retention update failed: HTTP ${updateResponse.status}`);
        }
    }

    console.log(`InfluxDB retention verified: ${bucketName}=${everySeconds}s`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
