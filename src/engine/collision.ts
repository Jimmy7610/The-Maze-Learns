/**
 * Collision detection — circle (ball) vs line segment.
 *
 * Single consistent collision model for ALL walls:
 * arc walls are pre-tessellated into polyline segments,
 * radial walls are already line segments.
 *
 * This avoids arc/radial corner jitter and "holes".
 */

import type { Ball } from './physics.js';

export interface Segment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface CollisionResult {
    hit: boolean;
    normal: { x: number; y: number };
    penetration: number;
}

/**
 * Test circle (ball) vs a single line segment.
 * Returns collision info if intersecting.
 */
export function circleVsSegment(ball: Ball, seg: Segment): CollisionResult {
    const NO_HIT: CollisionResult = { hit: false, normal: { x: 0, y: 0 }, penetration: 0 };

    // Vector from seg start to end
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq < 1e-10) return NO_HIT; // degenerate segment

    // Project ball center onto segment line, clamped to [0,1]
    const t = Math.max(0, Math.min(1, ((ball.x - seg.x1) * dx + (ball.y - seg.y1) * dy) / lenSq));

    // Closest point on segment
    const cx = seg.x1 + t * dx;
    const cy = seg.y1 + t * dy;

    // Distance from ball center to closest point
    const distX = ball.x - cx;
    const distY = ball.y - cy;
    const dist = Math.sqrt(distX * distX + distY * distY);

    if (dist >= ball.radius || dist < 1e-10) return NO_HIT;

    // Collision normal (from wall toward ball center)
    const nx = distX / dist;
    const ny = distY / dist;

    return {
        hit: true,
        normal: { x: nx, y: ny },
        penetration: ball.radius - dist,
    };
}

/**
 * Test ball against all segments, resolve all collisions.
 * Returns total number of collisions found.
 */
export function resolveCollisions(
    ball: Ball,
    segments: Segment[],
    bounceFn: (ball: Ball, normal: { x: number; y: number }, penetration: number) => void,
): number {
    let collisionCount = 0;

    for (const seg of segments) {
        const result = circleVsSegment(ball, seg);
        if (result.hit) {
            bounceFn(ball, result.normal, result.penetration);
            collisionCount++;
        }
    }

    return collisionCount;
}

/**
 * Tessellate an arc into line segments.
 * Arc from angle theta1 to theta2 at radius r, centered at (cx, cy).
 * @param numSegments Number of segments to approximate the arc.
 */
export function tessellateArc(
    cx: number,
    cy: number,
    r: number,
    theta1: number,
    theta2: number,
    numSegments: number,
): Segment[] {
    const segments: Segment[] = [];
    const dTheta = (theta2 - theta1) / numSegments;

    for (let i = 0; i < numSegments; i++) {
        const a1 = theta1 + i * dTheta;
        const a2 = theta1 + (i + 1) * dTheta;
        segments.push({
            x1: cx + r * Math.cos(a1),
            y1: cy + r * Math.sin(a1),
            x2: cx + r * Math.cos(a2),
            y2: cy + r * Math.sin(a2),
        });
    }

    return segments;
}
