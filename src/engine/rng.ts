/**
 * Seeded PRNG — Mulberry32.
 *
 * Deterministic: same seed → same sequence.
 * Seed policy:
 *   baseSeed = set at session start
 *   attemptSeed = baseSeed + attemptIndex
 *   If generation fails, increment seed by 1 until success.
 */

export interface RNG {
    /** Returns a float in [0, 1) */
    next(): number;
    /** Returns an integer in [min, max) */
    nextInt(min: number, max: number): number;
    /** Returns a float in [min, max) */
    nextFloat(min: number, max: number): number;
    /** Shuffle an array in-place */
    shuffle<T>(arr: T[]): T[];
    /** Current seed (for debug/logging) */
    readonly seed: number;
}

export function createRNG(seed: number): RNG {
    let state = seed | 0;

    function next(): number {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function nextInt(min: number, max: number): number {
        return Math.floor(next() * (max - min)) + min;
    }

    function nextFloat(min: number, max: number): number {
        return next() * (max - min) + min;
    }

    function shuffle<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = nextInt(0, i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    return {
        next,
        nextInt,
        nextFloat,
        shuffle,
        get seed() {
            return seed;
        },
    };
}

/**
 * Seed policy helpers.
 */
export function computeAttemptSeed(baseSeed: number, attemptIndex: number): number {
    return baseSeed + attemptIndex;
}
