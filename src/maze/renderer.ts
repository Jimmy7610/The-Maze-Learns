/**
 * Maze renderer — draws the circular maze on a Canvas 2D context.
 *
 * Classic wall-on / wall-off model:
 *   wallXxx = true  →  draw the wall (solid line/arc)
 *   wallXxx = false →  draw nothing (empty corridor)
 *
 * Also exports buildCollisionSegments() for collision detection.
 */

import type { Segment } from '../engine/collision.js';
import { tessellateArc } from '../engine/collision.js';
import type { MazeConfig, MazeData, ExitSector } from './types.js';
import { sliceAngle, ringInnerRadius, ringOuterRadius } from './types.js';

// Tessellation quality: segments per arc wall
const ARC_SEGMENTS = 8;

// Visual style
const WALL_COLOR = '#8b7fc7';
const WALL_WIDTH = 2;
const EXIT_COLOR = '#4ade80';
const EXIT_GLOW_COLOR = 'rgba(74, 222, 128, 0.15)';
const CENTER_VOID_COLOR = 'rgba(139, 127, 199, 0.08)';

/**
 * Render the maze onto a canvas context.
 * Assumes the context is already translated to the maze center.
 */
export function renderMaze(ctx: CanvasRenderingContext2D, maze: MazeData): void {
    const { cells, config, exit } = maze;
    const { rings, slices } = config;
    const sa = sliceAngle(slices);

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

            // Inner arc wall — draw if present (including ring 0)
            if (cell.wallInner) {
                ctx.beginPath();
                ctx.arc(0, 0, rInner, theta0, theta1);
                ctx.stroke();
            }

            // Outer arc wall — draw if present (skip exit)
            if (cell.wallOuter) {
                const isExit = r === rings - 1 && isExitSlice(s, exit, slices);
                if (!isExit) {
                    ctx.beginPath();
                    ctx.arc(0, 0, rOuter, theta0, theta1);
                    ctx.stroke();
                }
            }

            // CW radial wall — draw if present
            if (cell.wallCW) {
                ctx.beginPath();
                ctx.moveTo(rInner * Math.cos(theta1), rInner * Math.sin(theta1));
                ctx.lineTo(rOuter * Math.cos(theta1), rOuter * Math.sin(theta1));
                ctx.stroke();
            }
        }
    }

    // Outer boundary (solid except exit)
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
 * Build collision segments — same logic as rendering.
 * Solid walls become collision line segments.
 */
export function buildCollisionSegments(maze: MazeData): Segment[] {
    const segments: Segment[] = [];
    const { cells, config, exit } = maze;
    const { rings, slices } = config;
    const sa = sliceAngle(slices);

    for (let r = 0; r < rings; r++) {
        const rInner = ringInnerRadius(config, r);
        const rOuter = ringOuterRadius(config, r);

        for (let s = 0; s < slices; s++) {
            const cell = cells[r][s];
            const theta0 = s * sa;
            const theta1 = (s + 1) * sa;

            // Inner arc wall
            if (cell.wallInner) {
                segments.push(...tessellateArc(0, 0, rInner, theta0, theta1, ARC_SEGMENTS));
            }

            // Outer arc wall (skip exit)
            if (cell.wallOuter) {
                const isExit = r === rings - 1 && isExitSlice(s, exit, slices);
                if (!isExit) {
                    segments.push(...tessellateArc(0, 0, rOuter, theta0, theta1, ARC_SEGMENTS));
                }
            }

            // CW radial wall
            if (cell.wallCW) {
                const isExitBoundary =
                    r === rings - 1 &&
                    isExitSlice(s, exit, slices) &&
                    isExitSlice((s + 1) % slices, exit, slices);
                if (!isExitBoundary) {
                    segments.push({
                        x1: rInner * Math.cos(theta1),
                        y1: rInner * Math.sin(theta1),
                        x2: rOuter * Math.cos(theta1),
                        y2: rOuter * Math.sin(theta1),
                    });
                }
            }
        }
    }

    // Outer boundary (solid minus exit)
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
