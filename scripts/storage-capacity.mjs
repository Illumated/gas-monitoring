const channels = 5;
const pollIntervalSeconds = 2;
const retentionDays = 365;
const secondsPerDay = 86400;
const pointsPerYear = channels * secondsPerDay * retentionDays / pollIntervalSeconds;
const bytesPerPointScenarios = [16, 32, 64];
const gib = 1024 ** 3;

const scenarios = bytesPerPointScenarios.map((bytesPerPoint) => ({
    bytesPerPoint,
    gib: Number((pointsPerYear * bytesPerPoint / gib).toFixed(2))
}));

const result = {
    model: "up to five gas fields written independently every two seconds",
    channels,
    pollIntervalSeconds,
    retentionDays,
    pointsPerYear,
    compressedDataScenarios: scenarios,
    recommendedInfluxVolumeGiB: 20,
    recommendedBackupSpaceGiB: 20,
    warningPercent: 70,
    criticalPercent: 85,
    limitations: [
        "16/32/64 bytes per point are planning scenarios, not a measured InfluxDB guarantee",
        "event journal, WAL, indexes, compaction and filesystem overhead are covered by operational headroom",
        "recalculate from actual disk growth after at least seven days on the target host"
    ]
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    if (process.argv.includes("--json")) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(`Annual points: ${pointsPerYear.toLocaleString("en-US")}`);
        console.log(`Compressed data scenarios: ${scenarios.map((item) => `${item.bytesPerPoint} B/point=${item.gib} GiB`).join(", ")}`);
        console.log(`Plan at least ${result.recommendedInfluxVolumeGiB} GiB for InfluxDB and ${result.recommendedBackupSpaceGiB} GiB for backups.`);
    }
}

export default result;
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
