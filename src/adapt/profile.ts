/**
 * Player profile — EMA (Exponential Moving Average) of metrics across attempts.
 */

import type { AttemptMetrics } from './metrics.js';

const EMA_ALPHA = 0.3; // how much weight to give to the latest attempt

export interface PlayerProfile {
    avgSpeed: number;
    avgIdleRatio: number;
    avgRiskRatio: number;
    avgCollisions: number;
    avgDirChanges: number;
    avgExploration: number;
    avgTime: number;
    attempts: number;
}

export function createProfile(): PlayerProfile {
    return {
        avgSpeed: 0,
        avgIdleRatio: 0,
        avgRiskRatio: 0,
        avgCollisions: 0,
        avgDirChanges: 0,
        avgExploration: 0,
        avgTime: 0,
        attempts: 0,
    };
}

/**
 * Update the player profile with the latest attempt metrics using EMA.
 */
export function updateProfile(profile: PlayerProfile, metrics: AttemptMetrics): void {
    profile.attempts++;

    if (profile.attempts === 1) {
        // First attempt: use values directly
        profile.avgSpeed = metrics.avgSpeed;
        profile.avgIdleRatio = metrics.idleRatio;
        profile.avgRiskRatio = metrics.riskRatio;
        profile.avgCollisions = metrics.collisionCount;
        profile.avgDirChanges = metrics.directionChanges;
        profile.avgExploration = metrics.exploration;
        profile.avgTime = metrics.totalTime;
    } else {
        // EMA update
        profile.avgSpeed = ema(profile.avgSpeed, metrics.avgSpeed);
        profile.avgIdleRatio = ema(profile.avgIdleRatio, metrics.idleRatio);
        profile.avgRiskRatio = ema(profile.avgRiskRatio, metrics.riskRatio);
        profile.avgCollisions = ema(profile.avgCollisions, metrics.collisionCount);
        profile.avgDirChanges = ema(profile.avgDirChanges, metrics.directionChanges);
        profile.avgExploration = ema(profile.avgExploration, metrics.exploration);
        profile.avgTime = ema(profile.avgTime, metrics.totalTime);
    }
}

function ema(prev: number, current: number): number {
    return prev * (1 - EMA_ALPHA) + current * EMA_ALPHA;
}
