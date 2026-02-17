/**
 * Maze renderer — draws the circular maze on a Canvas 2D context.
 *
 * All walls are drawn as line segments (arcs tessellated into polylines).
 * Exit sector is highlighted.
 *
 * Also exports wallSegments() for collision detection.
 */

import type { Segment } from '../engine/collision.js';
import { tessellateArc } from '../engine/collision.js';
import type { MazeConfig, MazeData, ExitSector } from './types.js';
import { sliceAngle, ringInnerRadius, ringOuterRadius } from './types.js';

// Tessellation quality: segments per arc wall
const ARC_SEGMENTS = 8;

// Visual style
const WALL_COLOR = '#8b7fc7';
const WALL_WIDTH = 2.5;
const EXIT_COLOR = '#4ade80';
const EXIT_GLOW_COLOR = 'rgba(74, 222, 128, 0.15)';
const CENTER_VOID_COLOR = 'rgba(139, 127, 199, 0.08)';

/**
 * Build all wall segments for collision detection.
 * Call this once per maze generation (not every frame).
 */


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

            // Inner arc wall
            if (cell.wallInner && r > 0) {
                ctx.beginPath();
                ctx.arc(0, 0, rInner, theta0, theta1);
                ctx.stroke();
            }

            // Outer arc wall
            if (cell.wallOuter) {
                const isExit = r === rings - 1 && isExitSliceForRender(s, exit, slices);
                if (!isExit) {
                    ctx.beginPath();
                    ctx.arc(0, 0, rOuter, theta0, theta1);
                    ctx.stroke();
                }
            }

            // CW radial wall
            if (cell.wallCW) {
                ctx.beginPath();
                ctx.moveTo(rInner * Math.cos(theta1), rInner * Math.sin(theta1));
                ctx.lineTo(rOuter * Math.cos(theta1), rOuter * Math.sin(theta1));
                ctx.stroke();
            }
        }
    }

    // Draw outer boundary
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = 3;
    const outerR = ringOuterRadius(config, rings - 1);
    for (let s = 0; s < slices; s++) {
        if (!isExitSliceForRender(s, exit, slices)) {
            const theta0 = s * sa;
            const theta1 = (s + 1) * sa;
            ctx.beginPath();
            ctx.arc(0, 0, outerR, theta0, theta1);
            ctx.stroke();
        }
    }

    // Draw inner boundary
    if (config.innerRadius > 0) {
        ctx.strokeStyle = WALL_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, config.innerRadius, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function isExitSliceForRender(slice: number, exit: ExitSector, slices: number): boolean {
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

    // Glow band at outer edge only (not a wedge from center)
    const bandInner = outerR - 8;
    const bandOuter = outerR + 24;

    ctx.beginPath();
    ctx.arc(0, 0, bandOuter, exitTheta0, exitTheta1);
    ctx.arc(0, 0, bandInner, exitTheta1, exitTheta0, true);
    ctx.closePath();
    ctx.fillStyle = EXIT_GLOW_COLOR;
    ctx.fill();

    // Dashed arc marker just outside the exit
    ctx.strokeStyle = EXIT_COLOR;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, outerR + 6, exitTheta0, exitTheta1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small radial ticks at exit edges
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
 * Build collision segments with corrected exit detection.
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
            if (cell.wallInner && r > 0) {
                segments.push(...tessellateArc(0, 0, rInner, theta0, theta1, ARC_SEGMENTS));
            }

            // Outer arc wall — skip exit on outermost ring
            if (cell.wallOuter) {
                const isExit = r === rings - 1 && isExitSliceForRender(s, exit, slices);
                if (!isExit) {
                    segments.push(...tessellateArc(0, 0, rOuter, theta0, theta1, ARC_SEGMENTS));
                }
            }

            // CW radial wall
            if (cell.wallCW) {
                // Skip radial walls at exit boundaries on outermost ring
                const isExitBoundary =
                    r === rings - 1 &&
                    isExitSliceForRender(s, exit, slices) &&
                    isExitSliceForRender((s + 1) % slices, exit, slices);
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

    // Inner boundary circle
    if (config.innerRadius > 0) {
        segments.push(
            ...tessellateArc(0, 0, config.innerRadius, 0, 2 * Math.PI, slices * ARC_SEGMENTS),
        );
    }

    // Outer boundary (complete circle minus exit sector)
    const outerR = ringOuterRadius(config, rings - 1);
    for (let s = 0; s < slices; s++) {
        if (!isExitSliceForRender(s, exit, slices)) {
            const theta0 = s * sa;
            const theta1 = (s + 1) * sa;
            segments.push(...tessellateArc(0, 0, outerR, theta0, theta1, ARC_SEGMENTS));
        }
    }

    return segments;
}
