/**
 * Maze renderer — draws the circular maze on a Canvas 2D context.
 *
 * PASSAGE CLAMPING: When an arc opening is wider than MAX_PASSAGE,
 * wall stubs are drawn from both edges to narrow it down to exactly
 * MAX_PASSAGE. Small openings (inner rings) are left fully open.
 * This gives uniform passage widths across all radii.
 *
 * Also exports buildCollisionSegments() for collision detection.
 */

import type { Segment } from '../engine/collision.js';
import { tessellateArc } from '../engine/collision.js';
import type { MazeConfig, MazeData, ExitSector } from './types.js';
import { sliceAngle, ringInnerRadius, ringOuterRadius } from './types.js';

// Tessellation quality: segments per arc wall
const ARC_SEGMENTS = 8;

// Maximum passage width: openings wider than this get narrowed with stubs
const PASSAGE_FACTOR = 3; // × ball diameter

// Visual style
const WALL_COLOR = '#8b7fc7';
const WALL_WIDTH = 2;
const EXIT_COLOR = '#4ade80';
const EXIT_GLOW_COLOR = 'rgba(74, 222, 128, 0.15)';
const CENTER_VOID_COLOR = 'rgba(139, 127, 199, 0.08)';

function maxPassage(config: MazeConfig): number {
    return PASSAGE_FACTOR * config.ballRadius * 2;
}

/**
 * Deterministic hash for (ring, slice, wallType) → 0..1.
 * Used to randomize gap positions so they don't align radially.
 */
function cellHash(ring: number, slice: number, salt: number): number {
    let h = (ring * 7919 + slice * 104729 + salt * 31) | 0;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    h = (h >> 16) ^ h;
    return (h & 0x7fffffff) / 0x7fffffff;
}

// ─── Rendering ────────────────────────────────────────────────

export function renderMaze(ctx: CanvasRenderingContext2D, maze: MazeData): void {
    const { cells, config, exit, solutionPath } = maze;
    const { rings, slices } = config;
    const sa = sliceAngle(slices);
    const maxPass = maxPassage(config);

    // Build set of solution cells: skip clamping on these
    const solCells = new Set<string>();
    for (const [r, s] of solutionPath) solCells.add(`${r},${s}`);

    // Center void fill
    if (config.innerRadius > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, config.innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = CENTER_VOID_COLOR;
        ctx.fill();
    }

    drawExitHighlight(ctx, config, exit);

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

            // ─── Inner arc wall ───
            if (cell.wallInner) {
                drawArc(ctx, rInner, theta0, theta1);
            } else if (solCells.has(`${r},${s}`)) {
                // Solution path: fully open, no clamping
            } else {
                drawClampedPassageArc(ctx, rInner, theta0, theta1, maxPass, r, s, 0);
            }

            // ─── Outer arc wall ───
            const isExit = r === rings - 1 && isExitSlice(s, exit, slices);
            if (cell.wallOuter && !isExit) {
                drawArc(ctx, rOuter, theta0, theta1);
            } else if (!cell.wallOuter && !isExit) {
                if (solCells.has(`${r},${s}`)) {
                    // Solution path: fully open
                } else {
                    drawClampedPassageArc(ctx, rOuter, theta0, theta1, maxPass, r, s, 1);
                }
            }

            // ─── CW radial wall ───
            if (cell.wallCW) {
                drawRadial(ctx, rInner, rOuter, theta1);
            }
            // Open radial walls: ring width is already ~3× ball diameter, no clamping needed
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
            drawArc(ctx, outerR, theta0, theta1);
        }
    }
}

/** Draw a full arc wall. */
function drawArc(ctx: CanvasRenderingContext2D, r: number, t0: number, t1: number): void {
    ctx.beginPath();
    ctx.arc(0, 0, r, t0, t1);
    ctx.stroke();
}

/** Draw a full radial wall. */
function drawRadial(
    ctx: CanvasRenderingContext2D,
    rInner: number,
    rOuter: number,
    theta: number,
): void {
    ctx.beginPath();
    ctx.moveTo(rInner * Math.cos(theta), rInner * Math.sin(theta));
    ctx.lineTo(rOuter * Math.cos(theta), rOuter * Math.sin(theta));
    ctx.stroke();
}

/**
 * For an open arc wall: if the arc is wider than maxPass,
 * draw stubs from both edges to narrow the passage.
 * Gap position is randomized using cell hash to avoid alignment.
 */
function drawClampedPassageArc(
    ctx: CanvasRenderingContext2D,
    r: number,
    theta0: number,
    theta1: number,
    maxPass: number,
    ring: number,
    slice: number,
    salt: number,
): void {
    const arcLen = r * (theta1 - theta0);
    if (arcLen <= maxPass) return;

    const gapAngle = maxPass / r;
    const totalAngle = theta1 - theta0;
    // Random offset: gap can be anywhere within the arc (with margin so stubs exist)
    const margin = gapAngle * 0.1; // tiny margin so stubs are visible
    const range = totalAngle - gapAngle - margin * 2;
    const offset = margin + cellHash(ring, slice, salt) * Math.max(0, range);
    const gapStart = theta0 + offset;
    const gapEnd = gapStart + gapAngle;

    // Left stub
    if (gapStart > theta0 + 0.001) {
        ctx.beginPath();
        ctx.arc(0, 0, r, theta0, gapStart);
        ctx.stroke();
    }
    // Right stub
    if (gapEnd < theta1 - 0.001) {
        ctx.beginPath();
        ctx.arc(0, 0, r, gapEnd, theta1);
        ctx.stroke();
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

    const bandInner = outerR - 8;
    const bandOuter = outerR + 24;

    ctx.beginPath();
    ctx.arc(0, 0, bandOuter, exitTheta0, exitTheta1);
    ctx.arc(0, 0, bandInner, exitTheta1, exitTheta0, true);
    ctx.closePath();
    ctx.fillStyle = EXIT_GLOW_COLOR;
    ctx.fill();

    ctx.strokeStyle = EXIT_COLOR;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, outerR + 6, exitTheta0, exitTheta1);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = EXIT_COLOR;
    ctx.lineWidth = 2;
    for (const theta of [exitTheta0, exitTheta1]) {
        ctx.beginPath();
        ctx.moveTo(bandInner * Math.cos(theta), bandInner * Math.sin(theta));
        ctx.lineTo(bandOuter * Math.cos(theta), bandOuter * Math.sin(theta));
        ctx.stroke();
    }
}

// ─── Collision Segments ───────────────────────────────────────

export function buildCollisionSegments(maze: MazeData): Segment[] {
    const segments: Segment[] = [];
    const { cells, config, exit, solutionPath } = maze;
    const { rings, slices } = config;
    const sa = sliceAngle(slices);
    const maxPass = maxPassage(config);

    // Build set of solution cells: skip clamping on these
    const solCells = new Set<string>();
    for (const [r, s] of solutionPath) solCells.add(`${r},${s}`);

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
            } else if (solCells.has(`${r},${s}`)) {
                // Solution path: fully open, no collision stubs
            } else {
                addClampedPassageSegments(segments, rInner, theta0, theta1, maxPass, r, s, 0);
            }

            // Outer arc wall (skip exit)
            const isExit = r === rings - 1 && isExitSlice(s, exit, slices);
            if (isExit) continue;

            if (cell.wallOuter) {
                segments.push(...tessellateArc(0, 0, rOuter, theta0, theta1, ARC_SEGMENTS));
            } else if (solCells.has(`${r},${s}`)) {
                // Solution path: fully open
            } else {
                addClampedPassageSegments(segments, rOuter, theta0, theta1, maxPass, r, s, 1);
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

/**
 * For an open arc passage: if wider than maxPass, add stub collision segments.
 * Gap position randomized using same hash as rendering.
 */
function addClampedPassageSegments(
    segments: Segment[],
    r: number,
    theta0: number,
    theta1: number,
    maxPass: number,
    ring: number,
    slice: number,
    salt: number,
): void {
    const arcLen = r * (theta1 - theta0);
    if (arcLen <= maxPass) return;

    const gapAngle = maxPass / r;
    const totalAngle = theta1 - theta0;
    const margin = gapAngle * 0.1;
    const range = totalAngle - gapAngle - margin * 2;
    const offset = margin + cellHash(ring, slice, salt) * Math.max(0, range);
    const gapStart = theta0 + offset;
    const gapEnd = gapStart + gapAngle;

    if (gapStart > theta0 + 0.001) {
        segments.push(...tessellateArc(0, 0, r, theta0, gapStart, ARC_SEGMENTS));
    }
    if (gapEnd < theta1 - 0.001) {
        segments.push(...tessellateArc(0, 0, r, gapEnd, theta1, ARC_SEGMENTS));
    }
}
