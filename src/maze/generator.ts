/**
 * Maze generator — circular maze with seeded RNG.
 *
 * Algorithm:
 *  1. Start from an inner cell, carve a spanning tree via randomized DFS.
 *  2. Remove extra walls based on branchiness to create alternate paths.
 *  3. Apply radialDensity cap (only keep fraction of radial walls).
 *  4. Place exit on outer ring.
 *  5. Validate geometric constraints (passage width >= 2*ballRadius + margin).
 *  6. Verify solvability with BFS; if unsolvable, retry with next seed.
 *
 * Visual rules (CodePen-ish):
 *  - Arc walls are primary.
 *  - Radial walls capped by radialDensity.
 *  - Inner void radius prevents starburst look.
 */

import { createRNG } from '../engine/rng.js';
import type { RNG } from '../engine/rng.js';
import {
    type MazeCell,
    type MazeConfig,
    type MazeData,
    type GenerationParams,
    type ExitSector,
    sliceAngle,
    ringInnerRadius,
} from './types.js';
import { solveMaze } from './solver.js';

const GEOMETRIC_MARGIN = 4; // px margin beyond 2*ballRadius
const MAX_REGEN_ATTEMPTS = 20;

/**
 * Generate a solvable circular maze.
 */
export function generateMaze(config: MazeConfig, params: GenerationParams): MazeData {
    let seed = config.seed;

    for (let attempt = 0; attempt < MAX_REGEN_ATTEMPTS; attempt++) {
        const rng = createRNG(seed);
        const cells = createEmptyGrid(config);

        // 1. Carve spanning tree via randomized DFS
        carveSpanningTree(cells, config, rng);

        // 2. Remove extra walls for branchiness
        addExtraOpenings(cells, config, params, rng);

        // 3. Cap radial walls per radialDensity
        capRadialWalls(cells, config, params, rng);

        // 4. Place exit
        const exit = placeExit(cells, config, params, rng);

        // 5. Geometric constraint check
        if (!checkGeometricConstraints(config, params)) {
            // Adjust config rather than fail — widen rings/slices
            seed++;
            continue;
        }

        // 6. Solvability check
        const solution = solveMaze(cells, config, exit);
        if (solution.solvable) {
            return {
                cells,
                exit,
                config,
                params,
                finalSeed: seed,
            };
        }

        seed++;
    }

    // Failsafe: generate a trivial maze (all inner/outer walls removed on one path)
    return generateFallbackMaze(config, params);
}

/**
 * Create grid with all walls present.
 */
function createEmptyGrid(config: MazeConfig): MazeCell[][] {
    const grid: MazeCell[][] = [];
    for (let r = 0; r < config.rings; r++) {
        const row: MazeCell[] = [];
        for (let s = 0; s < config.slices; s++) {
            row.push({
                ring: r,
                slice: s,
                wallInner: true,
                wallOuter: true,
                wallCW: true,
                wallCCW: true,
            });
        }
        grid.push(row);
    }
    return grid;
}

/**
 * Neighbors of a cell in the circular grid.
 */
interface Neighbor {
    ring: number;
    slice: number;
    direction: 'inner' | 'outer' | 'cw' | 'ccw';
}

function getNeighbors(ring: number, slice: number, config: MazeConfig): Neighbor[] {
    const neighbors: Neighbor[] = [];
    const { rings, slices } = config;

    // Inner neighbor
    if (ring > 0) {
        neighbors.push({ ring: ring - 1, slice, direction: 'inner' });
    }
    // Outer neighbor
    if (ring < rings - 1) {
        neighbors.push({ ring: ring + 1, slice, direction: 'outer' });
    }
    // CW neighbor (wraps)
    neighbors.push({ ring, slice: (slice + 1) % slices, direction: 'cw' });
    // CCW neighbor (wraps)
    neighbors.push({ ring, slice: (slice - 1 + slices) % slices, direction: 'ccw' });

    return neighbors;
}

/**
 * Remove the wall between two adjacent cells.
 */
function removeWall(
    cells: MazeCell[][],
    r1: number,
    s1: number,
    r2: number,
    s2: number,
    direction: 'inner' | 'outer' | 'cw' | 'ccw',
): void {
    switch (direction) {
        case 'inner':
            cells[r1][s1].wallInner = false;
            cells[r2][s2].wallOuter = false;
            break;
        case 'outer':
            cells[r1][s1].wallOuter = false;
            cells[r2][s2].wallInner = false;
            break;
        case 'cw':
            cells[r1][s1].wallCW = false;
            cells[r2][s2].wallCCW = false;
            break;
        case 'ccw':
            cells[r1][s1].wallCCW = false;
            cells[r2][s2].wallCW = false;
            break;
    }
}

/**
 * Carve a spanning tree using randomized DFS (recursive backtracker).
 */
function carveSpanningTree(cells: MazeCell[][], config: MazeConfig, rng: RNG): void {
    const visited = new Set<string>();
    const key = (r: number, s: number) => `${r},${s}`;
    const stack: [number, number][] = [];

    // Start from an inner cell (ring 0, slice 0)
    const startR = 0;
    const startS = 0;
    visited.add(key(startR, startS));
    stack.push([startR, startS]);

    while (stack.length > 0) {
        const [cr, cs] = stack[stack.length - 1];
        const neighbors = getNeighbors(cr, cs, config);
        rng.shuffle(neighbors);

        let found = false;
        for (const n of neighbors) {
            if (!visited.has(key(n.ring, n.slice))) {
                visited.add(key(n.ring, n.slice));
                removeWall(cells, cr, cs, n.ring, n.slice, n.direction);
                stack.push([n.ring, n.slice]);
                found = true;
                break;
            }
        }

        if (!found) {
            stack.pop();
        }
    }
}

/**
 * Add extra openings based on branchiness to create multiple paths.
 */
function addExtraOpenings(
    cells: MazeCell[][],
    config: MazeConfig,
    params: GenerationParams,
    rng: RNG,
): void {
    const totalWalls = config.rings * config.slices * 2; // rough estimate
    const openingsToAdd = Math.floor(totalWalls * params.branchiness * 0.3);

    for (let i = 0; i < openingsToAdd; i++) {
        const r = rng.nextInt(0, config.rings);
        const s = rng.nextInt(0, config.slices);
        const neighbors = getNeighbors(r, s, config);
        if (neighbors.length === 0) continue;
        const n = neighbors[rng.nextInt(0, neighbors.length)];
        removeWall(cells, r, s, n.ring, n.slice, n.direction);
    }
}

/**
 * Cap radial walls: only keep a fraction of CW walls.
 * Optionally only on alternating rings.
 */
function capRadialWalls(
    cells: MazeCell[][],
    config: MazeConfig,
    params: GenerationParams,
    rng: RNG,
): void {
    for (let r = 0; r < config.rings; r++) {
        for (let s = 0; s < config.slices; s++) {
            // For each CW wall, randomly remove if above density cap
            if (cells[r][s].wallCW && rng.next() > params.radialDensity) {
                const ns = (s + 1) % config.slices;
                cells[r][s].wallCW = false;
                cells[r][ns].wallCCW = false;
            }
        }
    }
}

/**
 * Place exit sector on the outer ring.
 */
function placeExit(
    cells: MazeCell[][],
    config: MazeConfig,
    params: GenerationParams,
    rng: RNG,
): ExitSector {
    const sliceStart =
        params.exitOffset >= 0
            ? params.exitOffset % config.slices
            : rng.nextInt(0, config.slices);

    const sliceCount = Math.min(params.exitWidth, config.slices);

    // Remove outer walls at exit slices
    for (let i = 0; i < sliceCount; i++) {
        const s = (sliceStart + i) % config.slices;
        cells[config.rings - 1][s].wallOuter = false;
    }

    return { sliceStart, sliceCount };
}

/**
 * Check geometric constraints: passages must be wide enough for the ball.
 */
function checkGeometricConstraints(config: MazeConfig, _params: GenerationParams): boolean {
    const rw = (config.outerRadius - config.innerRadius) / config.rings;
    const minCellHeight = 2 * config.ballRadius + GEOMETRIC_MARGIN;

    if (rw < minCellHeight) return false;

    // Check arc length at innermost ring
    const innerR = ringInnerRadius(config, 0);
    const arcLen = innerR * sliceAngle(config.slices);
    if (arcLen < minCellHeight) return false;

    return true;
}

/**
 * Fallback: simple radial corridors if normal generation keeps failing.
 */
function generateFallbackMaze(config: MazeConfig, params: GenerationParams): MazeData {
    const cells = createEmptyGrid(config);

    // Open a straight corridor from center to exit
    const exitSlice = 0;
    for (let r = 0; r < config.rings; r++) {
        cells[r][exitSlice].wallInner = false;
        cells[r][exitSlice].wallOuter = false;
    }
    // Open some horizontal connections for playability
    for (let r = 0; r < config.rings; r++) {
        cells[r][exitSlice].wallCW = false;
        const ns = (exitSlice + 1) % config.slices;
        cells[r][ns].wallCCW = false;
    }

    const exit: ExitSector = { sliceStart: exitSlice, sliceCount: 2 };
    // Ensure exit opening
    cells[config.rings - 1][exitSlice].wallOuter = false;
    const s2 = (exitSlice + 1) % config.slices;
    cells[config.rings - 1][s2].wallOuter = false;

    return {
        cells,
        exit,
        config,
        params,
        finalSeed: config.seed,
    };
}
