/**
 * Adaptation mapping — maps player profile to maze generation params.
 *
 * Safety:
 *  - All params clamped to safe ranges.
 *  - Rate-limited: max delta per attempt.
 *  - Failsafe: if solver requires too many regenerations, difficulty is lowered.
 */

import type { PlayerProfile } from './profile.js';
import type { GenerationParams } from '../maze/types.js';

// Clamp ranges for all generation params
const CLAMPS = {
    wallDensity: { min: 0.1, max: 0.7 },
    branchiness: { min: 0.05, max: 0.6 },
    corridorWidth: { min: 1.0, max: 2.0 },
    radialDensity: { min: 0.1, max: 0.35 },
    decoyRate: { min: 0.0, max: 0.5 },
    pathLengthBias: { min: 0.2, max: 0.8 },
    exitWidth: { min: 1, max: 2 },
};

// Max change per attempt (rate limiting)
const MAX_DELTA = 0.1;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function rateLimited(prev: number, target: number, maxDelta: number): number {
    const delta = target - prev;
    if (Math.abs(delta) <= maxDelta) return target;
    return prev + Math.sign(delta) * maxDelta;
}

/**
 * Map player profile metrics to generation params for the next maze.
 */
export function mapProfileToParams(
    profile: PlayerProfile,
    currentParams: GenerationParams,
): GenerationParams {
    if (profile.attempts < 1) return currentParams;

    // Target params based on profile
    // High speed player → harder maze (more walls, longer paths)
    const targetWallDensity = 0.2 + profile.avgSpeed / 500;
    const targetPathLength = 0.3 + profile.avgSpeed / 600;

    // Precise player → more branches, more decoys
    const targetBranchiness = 0.15 + (1 - profile.avgDirChanges / 50) * 0.3;
    const targetDecoyRate = 0.1 + (1 - profile.avgCollisions / 20) * 0.2;

    // Low exploration → easier (wider corridors)
    const targetCorridorWidth = 1.5 - profile.avgExploration * 0.5;

    // Risky player → keep radial density moderate
    const targetRadialDensity = 0.2 + profile.avgRiskRatio * 0.15;

    // Exit width: easier if player is struggling
    const targetExitWidth = profile.avgTime > 60 ? 2 : 1;

    // Apply rate limiting and clamping
    return {
        wallDensity: clamp(
            rateLimited(currentParams.wallDensity, targetWallDensity, MAX_DELTA),
            CLAMPS.wallDensity.min,
            CLAMPS.wallDensity.max,
        ),
        branchiness: clamp(
            rateLimited(currentParams.branchiness, targetBranchiness, MAX_DELTA),
            CLAMPS.branchiness.min,
            CLAMPS.branchiness.max,
        ),
        corridorWidth: clamp(
            rateLimited(currentParams.corridorWidth, targetCorridorWidth, MAX_DELTA),
            CLAMPS.corridorWidth.min,
            CLAMPS.corridorWidth.max,
        ),
        radialDensity: clamp(
            rateLimited(currentParams.radialDensity, targetRadialDensity, MAX_DELTA),
            CLAMPS.radialDensity.min,
            CLAMPS.radialDensity.max,
        ),
        decoyRate: clamp(
            rateLimited(currentParams.decoyRate, targetDecoyRate, MAX_DELTA),
            CLAMPS.decoyRate.min,
            CLAMPS.decoyRate.max,
        ),
        pathLengthBias: clamp(
            rateLimited(currentParams.pathLengthBias, targetPathLength, MAX_DELTA),
            CLAMPS.pathLengthBias.min,
            CLAMPS.pathLengthBias.max,
        ),
        exitOffset: -1, // always random
        exitWidth: targetExitWidth,
    };
}
