export const allInputs = Array.from(
    { length: 6 },
    (_, index) => [`IN${index + 1}P`, `IN${index + 1}N`]
).flat();

export function registersForInput(input) {
    const match = /^IN([1-6])([PN])$/.exec(String(input).toUpperCase());
    if (!match) {
        throw new Error(`Unsupported WB-MAI6 input: ${input}`);
    }

    const channel = Number(match[1]);
    const sideOffset = match[2] === "N" ? 1 : 0;
    const base = 4096 * channel;

    return {
        input: `IN${channel}${match[2]}`,
        type: base + 1024 + sideOffset,
        scaleLow: base + 1032 + sideOffset,
        scaleHigh: base + 1034 + sideOffset,
        value: base + 1284 + sideOffset
    };
}
