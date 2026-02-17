/**
 * Maze renderer — draws the circular maze on a Canvas 2D context.
 *
 * KEY DESIGN: When a wall is "open" (removed by the generator), we DON'T
 * skip the wall entirely. Instead, we draw most of the wall but leave a
 * small gap (2.5× ball diameter) in the center. This creates precise,
 * tight passages instead of enormous openings.
 *
 * Also exports buildCollisionSegments() for collision detection.
 */

import type { Segment } from '../engine/collision.js';
import { tessellateArc } from '../engine/collision.js';
import type { MazeConfig, MazeData, ExitSector } from './types.js';
import { sliceAngle, ringInnerRadius, ringOuterRadius } from './types.js';

// Tessellation quality: segments per arc wall
const ARC_SEGMENTS = 8;

// Gap size: this many ball diameters
const GAP_FACTOR = 2.5;

// Visual style
const WALL_COLOR = '#8b7fc7';
const WALL_WIDTH = 2;
const EXIT_COLOR = '#4ade80';
const EXIT_GLOW_COLOR = 'rgba(74, 222, 128, 0.15)';
const CENTER_VOID_COLOR = 'rgba(139, 127, 199, 0.08)';

/**
 * Compute the gap size in pixels for this maze config.
 */
function gapSize(config: MazeConfig): number {
    return GAP_FACTOR * config.ballRadius * 2;
}

/**
 * Render the maze onto a canvas context.
 * Assumes the context is already translated to the maze center.
 */
export function renderMaze(ctx: CanvasRenderingContext2D, maze: MazeData): void {
    const { cells, config, exit } = maze;
    const { rings, slices } = config;
    const sa = sliceAngle(slices);
    const gap = gapSize(config);

    // Draw center void
    if (config.innerRadius > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, config.innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = CENTER_VOID_COLOR;
        ctx.fill();
    }

    // Draw exit highlight
    drawExitHighlight(ctx, config, exit);

    // Draw walls
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = WALL_WIDTH;
    ctx.lineCap = 'round';

    for (let r = 0; r < rings; r++) {
        const rInner = ringInnerRadius(config, r);
        const rOuter = ringOuterRadius(config, r);

        for (let s = 0; s < slices; s++) {
            const cell = cells[r][s];
            const theta0 = s * sa;
            const theta1 = (s + 1) * sa;
            const thetaMid = (theta0 + theta1) / 2;

            // ─── Inner arc wall ───
            if (cell.wallInner) {
                // Solid wall
                ctx.beginPath();
                ctx.arc(0, 0, rInner, theta0, theta1);
                ctx.stroke();
            } else {
                // Open wall with small gap
                const gapAngle = gap / rInner;
                if (gapAngle < sa * 0.95) {
                    // Draw two arcs with a gap in the middle
                    ctx.beginPath();
                    ctx.arc(0, 0, rInner, theta0, thetaMid - gapAngle / 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, rInner, thetaMid + gapAngle / 2, theta1);
                    ctx.stroke();
                }
                // else: gap covers the whole arc, skip (fully open)
            }

            // ─── Outer arc wall ───
            const isExitOuter = r === rings - 1 && isExitSlice(s, exit, slices);
            if (cell.wallOuter && !isExitOuter) {
                // Solid wall
                ctx.beginPath();
                ctx.arc(0, 0, rOuter, theta0, theta1);
                ctx.stroke();
            } else if (!cell.wallOuter && !isExitOuter) {
                // Open wall with gap
                const gapAngle = gap / rOuter;
                if (gapAngle < sa * 0.95) {
                    ctx.beginPath();
                    ctx.arc(0, 0, rOuter, theta0, thetaMid - gapAngle / 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, rOuter, thetaMid + gapAngle / 2, theta1);
                    ctx.stroke();
                }
            }

            // ─── CW radial wall ───
            if (cell.wallCW) {
                // Solid wall
                ctx.beginPath();
                ctx.moveTo(rInner * Math.cos(theta1), rInner * Math.sin(theta1));
                ctx.lineTo(rOuter * Math.cos(theta1), rOuter * Math.sin(theta1));
                ctx.stroke();
            } else {
                // Open radial wall with gap
                const radialLen = rOuter - rInner;
                if (gap < radialLen * 0.95) {
                    const midR = (rInner + rOuter) / 2;
                    // Bottom half
                    ctx.beginPath();
                    ctx.moveTo(rInner * Math.cos(theta1), rInner * Math.sin(theta1));
                    ctx.lineTo((midR - gap / 2) * Math.cos(theta1), (midR - gap / 2) * Math.sin(theta1));
                    ctx.stroke();
                    // Top half
                    ctx.beginPath();
                    ctx.moveTo((midR + gap / 2) * Math.cos(theta1), (midR + gap / 2) * Math.sin(theta1));
                    ctx.lineTo(rOuter * Math.cos(theta1), rOuter * Math.sin(theta1));
                    ctx.stroke();
                }
            }
        }
    }

    // Draw outer boundary (solid, except exit)
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 2.5;
    const outerR = ringOuterRadius(config, rings - 1);
    for (let s = 0; s < slices; s++) {
        if (!isExitSlice(s, exit, slices)) {
            const theta0 = s * sa;
            const theta1 = (s + 1) * sa;
            ctx.beginPath();
            ctx.arc(0, 0, outerR, theta0, theta1);
            ctx.stroke();
        }
    }
}

function isExitSlice(slice: number, exit: ExitSector, slices: number): boolean {
    for (let i = 0; i < exit.sliceCount; i++) {
        if (slice === (exit.sliceStart + i) % slices) return true;
    }
    return false;
}

function drawExitHighlight(
    ctx: CanvasRenderingContext2D,
    config: MazeConfig,
    exit: ExitSector,
): void {
    const sa = sliceAngle(config.slices);
    const outerR = ringOuterRadius(config, config.rings - 1);
    const exitTheta0 = exit.sliceStart * sa;
    const exitTheta1 = (exit.sliceStart + exit.sliceCount) * sa;

    // Glow band at outer edge
    const bandInner = outerR - 8;
    const bandOuter = outerR + 24;

    ctx.beginPath();
    ctx.arc(0, 0, bandOuter, exitTheta0, exitTheta1);
    ctx.arc(0, 0, bandInner, exitTheta1, exitTheta0, true);
    ctx.closePath();
    ctx.fillStyle = EXIT_GLOW_COLOR;
    ctx.fill();

    // Dashed arc marker
    ctx.strokeStyle = EXIT_COLOR;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, outerR + 6, exitTheta0, exitTheta1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Radial ticks at exit edges
    ctx.strokeStyle = EXIT_COLOR;
    ctx.lineWidth = 2;
    for (const theta of [exitTheta0, exitTheta1]) {
        ctx.beginPath();
        ctx.moveTo(bandInner * Math.cos(theta), bandInner * Math.sin(theta));
        ctx.lineTo(bandOuter * Math.cos(theta), bandOuter * Math.sin(theta));
        ctx.stroke();
    }
}

/**
 * Build collision segments — matching the gap-based rendering.
 * Solid walls = full segments. Open walls = two segments with a gap.
 */
export function buildCollisionSegments(maze: MazeData): Segment[] {
    const segments: Segment[] = [];
    const { cells, config, exit } = maze;
    const { rings, slices } = config;
    const sa = sliceAngle(slices);
    const gap = gapSize(config);

    for (let r = 0; r < rings; r++) {
        const rInner = ringInnerRadius(config, r);
        const rOuter = ringOuterRadius(config, r);

        for (let s = 0; s < slices; s++) {
            const cell = cells[r][s];
            const theta0 = s * sa;
            const theta1 = (s + 1) * sa;
            const thetaMid = (theta0 + theta1) / 2;

            // ─── Inner arc wall ───
            if (cell.wallInner) {
                segments.push(...tessellateArc(0, 0, rInner, theta0, theta1, ARC_SEGMENTS));
            } else {
                const gapAngle = gap / rInner;
                if (gapAngle < sa * 0.95) {
                    segments.push(
                        ...tessellateArc(0, 0, rInner, theta0, thetaMid - gapAngle / 2, ARC_SEGMENTS),
                    );
                    segments.push(
                        ...tessellateArc(0, 0, rInner, thetaMid + gapAngle / 2, theta1, ARC_SEGMENTS),
                    );
                }
            }

            // ─── Outer arc wall ───
            const isExitOuter = r === rings - 1 && isExitSlice(s, exit, slices);
            if (isExitOuter) continue; // Exit is fully open

            if (cell.wallOuter) {
                segments.push(...tessellateArc(0, 0, rOuter, theta0, theta1, ARC_SEGMENTS));
            } else {
                const gapAngle = gap / rOuter;
                if (gapAngle < sa * 0.95) {
                    segments.push(
                        ...tessellateArc(0, 0, rOuter, theta0, thetaMid - gapAngle / 2, ARC_SEGMENTS),
                    );
                    segments.push(
                        ...tessellateArc(0, 0, rOuter, thetaMid + gapAngle / 2, theta1, ARC_SEGMENTS),
                    );
                }
            }

            // ─── CW radial wall ───
            if (cell.wallCW) {
                segments.push({
                    x1: rInner * Math.cos(theta1),
                    y1: rInner * Math.sin(theta1),
                    x2: rOuter * Math.cos(theta1),
                    y2: rOuter * Math.sin(theta1),
                });
            } else {
                const radialLen = rOuter - rInner;
                if (gap < radialLen * 0.95) {
                    const midR = (rInner + rOuter) / 2;
                    // Bottom segment
                    segments.push({
                        x1: rInner * Math.cos(theta1),
                        y1: rInner * Math.sin(theta1),
                        x2: (midR - gap / 2) * Math.cos(theta1),
                        y2: (midR - gap / 2) * Math.sin(theta1),
                    });
                    // Top segment
                    segments.push({
                        x1: (midR + gap / 2) * Math.cos(theta1),
                        y1: (midR + gap / 2) * Math.sin(theta1),
                        x2: rOuter * Math.cos(theta1),
                        y2: rOuter * Math.sin(theta1),
                    });
                }
            }
        }
    }

    // Outer boundary (solid circle minus exit sector)
    const outerR = ringOuterRadius(config, rings - 1);
    for (let s = 0; s < slices; s++) {
        if (!isExitSlice(s, exit, slices)) {
            const theta0 = s * sa;
            const theta1 = (s + 1) * sa;
            segments.push(...tessellateArc(0, 0, outerR, theta0, theta1, ARC_SEGMENTS));
        }
    }

    return segments;
}
