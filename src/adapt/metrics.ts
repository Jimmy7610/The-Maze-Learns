/**
 * Attempt metrics — measure player behavior per attempt.
 *
 * Tracks: speed, risk, precision, exploration.
 */

import type { Ball } from '../engine/physics.js';
import type { MazeConfig } from '../maze/types.js';
import { ringOuterRadius, sliceAngle } from '../maze/types.js';

export interface AttemptMetrics {
    /** Total time of attempt in seconds */
    totalTime: number;
    /** Average velocity magnitude */
    avgSpeed: number;
    /** Fraction of time spent idle (very low velocity) */
    idleRatio: number;
    /** Time spent near outer radius / total time */
    riskRatio: number;
    /** Total collision count */
    collisionCount: number;
    /** Direction change count */
    directionChanges: number;
    /** Approximate cell coverage (0..1) */
    exploration: number;
    /** Whether the attempt was a win */
    won: boolean;
}

export interface MetricsTracker {
    startTime: number;
    tickCount: number;
    totalSpeed: number;
    idleTicks: number;
    nearOuterTicks: number;
    collisions: number;
    dirChanges: number;
    visitedCells: Set<string>;
    config: MazeConfig;
    totalTime: number;
}

const IDLE_THRESHOLD = 5; // px/s
const OUTER_RISK_FRACTION = 0.85; // within 85% of outer radius = "near outer"

export function createMetricsTracker(config: MazeConfig): MetricsTracker {
    return {
        startTime: performance.now(),
        tickCount: 0,
        totalSpeed: 0,
        idleTicks: 0,
        nearOuterTicks: 0,
        collisions: 0,
        dirChanges: 0,
        visitedCells: new Set(),
        config,
        totalTime: 0,
    };
}

export function recordTick(
    tracker: MetricsTracker,
    ball: Ball,
    _mazeAngle: number,
    dt: number,
): void {
    tracker.tickCount++;
    tracker.totalTime += dt;

    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    tracker.totalSpeed += speed;

    if (speed < IDLE_THRESHOLD) {
        tracker.idleTicks++;
    }

    // Risk: near outer radius
    const dist = Math.sqrt(ball.x * ball.x + ball.y * ball.y);
    const outerR = ringOuterRadius(tracker.config, tracker.config.rings - 1);
    if (dist > outerR * OUTER_RISK_FRACTION) {
        tracker.nearOuterTicks++;
    }

    // Exploration: track visited cells
    const sa = sliceAngle(tracker.config.slices);
    let theta = Math.atan2(ball.y, ball.x);
    if (theta < 0) theta += 2 * Math.PI;
    const slice = Math.floor(theta / sa) % tracker.config.slices;

    const ringWidth =
        (tracker.config.outerRadius - tracker.config.innerRadius) / tracker.config.rings;
    const ring = Math.floor((dist - tracker.config.innerRadius) / ringWidth);
    if (ring >= 0 && ring < tracker.config.rings) {
        tracker.visitedCells.add(`${ring},${slice}`);
    }
}

export function recordCollision(tracker: MetricsTracker): void {
    tracker.collisions++;
}

export function recordDirectionChange(tracker: MetricsTracker): void {
    tracker.dirChanges++;
}

export function snapshotMetrics(tracker: MetricsTracker): AttemptMetrics {
    const ticks = Math.max(tracker.tickCount, 1);
    const totalCells = tracker.config.rings * tracker.config.slices;

    return {
        totalTime: tracker.totalTime,
        avgSpeed: tracker.totalSpeed / ticks,
        idleRatio: tracker.idleTicks / ticks,
        riskRatio: tracker.nearOuterTicks / ticks,
        collisionCount: tracker.collisions,
        directionChanges: tracker.dirChanges,
        exploration: tracker.visitedCells.size / totalCells,
        won: false, // set by caller
    };
}
