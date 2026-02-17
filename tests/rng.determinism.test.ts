import { describe, it, expect } from 'vitest';
import { createRNG, computeAttemptSeed } from '../src/engine/rng.js';

describe('RNG Determinism', () => {
    it('same seed produces identical sequence', () => {
        const a = createRNG(42);
        const b = createRNG(42);

        for (let i = 0; i < 100; i++) {
            expect(a.next()).toBe(b.next());
        }
    });

    it('different seeds produce different sequences', () => {
        const a = createRNG(42);
        const b = createRNG(99);

        let allSame = true;
        for (let i = 0; i < 20; i++) {
            if (a.next() !== b.next()) allSame = false;
        }
        expect(allSame).toBe(false);
    });

    it('next() returns values in [0, 1)', () => {
        const rng = createRNG(123);
        for (let i = 0; i < 1000; i++) {
            const v = rng.next();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('nextInt(min, max) returns integers in [min, max)', () => {
        const rng = createRNG(456);
        for (let i = 0; i < 500; i++) {
            const v = rng.nextInt(3, 10);
            expect(v).toBeGreaterThanOrEqual(3);
            expect(v).toBeLessThan(10);
            expect(Number.isInteger(v)).toBe(true);
        }
    });

    it('shuffle is deterministic', () => {
        const a = createRNG(77);
        const b = createRNG(77);

        const arr1 = [1, 2, 3, 4, 5, 6, 7, 8];
        const arr2 = [1, 2, 3, 4, 5, 6, 7, 8];

        a.shuffle(arr1);
        b.shuffle(arr2);

        expect(arr1).toEqual(arr2);
    });

    it('seed property reflects initial seed', () => {
        const rng = createRNG(999);
        expect(rng.seed).toBe(999);
        rng.next(); // consuming values doesn't change reported seed
        expect(rng.seed).toBe(999);
    });

    it('computeAttemptSeed returns baseSeed + attemptIndex', () => {
        expect(computeAttemptSeed(100, 0)).toBe(100);
        expect(computeAttemptSeed(100, 5)).toBe(105);
        expect(computeAttemptSeed(42, 1)).toBe(43);
    });
});
