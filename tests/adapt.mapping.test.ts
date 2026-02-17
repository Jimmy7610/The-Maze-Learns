import { describe, it, expect } from 'vitest';
import { mapProfileToParams } from '../src/adapt/mapping.js';
import { createProfile, updateProfile } from '../src/adapt/profile.js';
import { defaultGenerationParams } from '../src/maze/types.js';
import type { AttemptMetrics } from '../src/adapt/metrics.js';
import type { PlayerProfile } from '../src/adapt/profile.js';

function makeMetrics(overrides: Partial<AttemptMetrics> = {}): AttemptMetrics {
    return {
        totalTime: 30,
        avgSpeed: 100,
        idleRatio: 0.1,
        riskRatio: 0.2,
        collisionCount: 5,
        directionChanges: 10,
        exploration: 0.5,
        won: true,
        ...overrides,
    };
}

describe('Adaptation Mapping', () => {
    it('returns default params when profile has no attempts', () => {
        const profile = createProfile();
        const params = defaultGenerationParams();
        const result = mapProfileToParams(profile, params);
        expect(result).toEqual(params);
    });

    it('all params stay within clamp ranges for average player', () => {
        const profile = createProfile();
        updateProfile(profile, makeMetrics());
        const result = mapProfileToParams(profile, defaultGenerationParams());

        expect(result.wallDensity).toBeGreaterThanOrEqual(0.1);
        expect(result.wallDensity).toBeLessThanOrEqual(0.7);
        expect(result.branchiness).toBeGreaterThanOrEqual(0.05);
        expect(result.branchiness).toBeLessThanOrEqual(0.6);
        expect(result.corridorWidth).toBeGreaterThanOrEqual(1.0);
        expect(result.corridorWidth).toBeLessThanOrEqual(2.0);
        expect(result.radialDensity).toBeGreaterThanOrEqual(0.1);
        expect(result.radialDensity).toBeLessThanOrEqual(0.35);
        expect(result.decoyRate).toBeGreaterThanOrEqual(0.0);
        expect(result.decoyRate).toBeLessThanOrEqual(0.5);
        expect(result.pathLengthBias).toBeGreaterThanOrEqual(0.2);
        expect(result.pathLengthBias).toBeLessThanOrEqual(0.8);
    });

    it('params stay clamped for extreme high-speed player', () => {
        const profile = createProfile();
        updateProfile(profile, makeMetrics({ avgSpeed: 999, collisionCount: 0, directionChanges: 100 }));
        const result = mapProfileToParams(profile, defaultGenerationParams());

        expect(result.wallDensity).toBeLessThanOrEqual(0.7);
        expect(result.pathLengthBias).toBeLessThanOrEqual(0.8);
        expect(result.branchiness).toBeGreaterThanOrEqual(0.05);
    });

    it('params stay clamped for struggling player', () => {
        const profile = createProfile();
        updateProfile(
            profile,
            makeMetrics({
                avgSpeed: 5,
                totalTime: 120,
                collisionCount: 50,
                exploration: 0.1,
                directionChanges: 200,
            }),
        );
        const result = mapProfileToParams(profile, defaultGenerationParams());

        expect(result.wallDensity).toBeGreaterThanOrEqual(0.1);
        expect(result.corridorWidth).toBeGreaterThanOrEqual(1.0);
        expect(result.exitWidth).toBe(2); // easier exit for struggling player
    });

    it('rate-limits changes between attempts', () => {
        const profile = createProfile();
        const baseParams = defaultGenerationParams();

        // First attempt
        updateProfile(profile, makeMetrics({ avgSpeed: 500 }));
        const r1 = mapProfileToParams(profile, baseParams);

        // Extreme change in performance
        updateProfile(profile, makeMetrics({ avgSpeed: 10 }));
        const r2 = mapProfileToParams(profile, r1);

        // No param should change by more than MAX_DELTA (0.1)
        expect(Math.abs(r2.wallDensity - r1.wallDensity)).toBeLessThanOrEqual(0.1 + 1e-9);
        expect(Math.abs(r2.branchiness - r1.branchiness)).toBeLessThanOrEqual(0.1 + 1e-9);
        expect(Math.abs(r2.corridorWidth - r1.corridorWidth)).toBeLessThanOrEqual(0.1 + 1e-9);
    });

    it('EMA profile accumulates over multiple attempts', () => {
        const profile = createProfile();

        // 5 attempts
        for (let i = 0; i < 5; i++) {
            updateProfile(profile, makeMetrics({ avgSpeed: 100 + i * 20 }));
        }

        expect(profile.attempts).toBe(5);
        expect(profile.avgSpeed).toBeGreaterThan(100);
        expect(profile.avgSpeed).toBeLessThan(200);
    });
});
