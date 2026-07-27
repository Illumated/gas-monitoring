import assert from "node:assert/strict";
import { allInputs, registersForInput } from "../scripts/lib/wb-mai6-map.mjs";

assert.equal(allInputs.length, 12);
assert.deepEqual(registersForInput("IN1P"), {
    input: "IN1P",
    type: 5120,
    scaleLow: 5128,
    scaleHigh: 5130,
    value: 5380
});
assert.deepEqual(registersForInput("IN4P"), {
    input: "IN4P",
    type: 17408,
    scaleLow: 17416,
    scaleHigh: 17418,
    value: 17668
});
assert.deepEqual(registersForInput("IN6N"), {
    input: "IN6N",
    type: 25601,
    scaleLow: 25609,
    scaleHigh: 25611,
    value: 25861
});
assert.throws(() => registersForInput("IN7P"), /Unsupported/);

for (let channel = 1; channel <= 6; channel += 1) {
    const p = registersForInput(`IN${channel}P`);
    const n = registersForInput(`IN${channel}N`);
    assert.equal(n.type, p.type + 1);
    assert.equal(n.scaleLow, p.scaleLow + 1);
    assert.equal(n.scaleHigh, p.scaleHigh + 1);
    assert.equal(n.value, p.value + 1);
}

console.log("WB-MAI6 register map passed: 6 channels, 12 single-ended inputs");
