/**
 * Maze generator — circular maze with seeded RNG.
 *
 * Algorithm (Arc-biased for CodePen-ish look):
 *  1. Start all walls present.
 *  2. Carve spanning tree via randomized DFS with strong bias toward
 *     arc (CW/CCW) directions over radial (inner/outer). This creates
 *     winding corridors that spiral around the maze rather than starburst spokes.
 *  3. Remove extra arc walls based on branchiness to create alternate paths.
 *  4. Remove most remaining radial walls (keep only radialDensity fraction).
 *  5. Place exit on outer ring, ensuring no wall blocks it.
 *  6. Validate with BFS; if unsolvable, retry with next seed.
 *
 * Visual rules:
 *  - Arc walls are primary — they define the maze corridors.
 *  - Radial walls are sparse (radialDensity cap, default 0.25).
 *  - Inner void radius prevents star look at center.
 *  - Alternating-ring radial walls only.
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

const GEOMETRIC_MARGIN = 4;
const MAX_REGEN_ATTEMPTS = 20;

/** Weight multiplier for arc (CW/CCW) vs radial (inner/outer) in DFS. */
const ARC_BIAS = 4;

export function generateMaze(config: MazeConfig, params: GenerationParams): MazeData {
    let seed = config.seed;

    for (let attempt = 0; attempt < MAX_REGEN_ATTEMPTS; attempt++) {
        const rng = createRNG(seed);

        // Geometric constraint check up front
        if (!checkGeometricConstraints(config)) {
            seed++;
            continue;
        }

        const cells = createEmptyGrid(config);

        // 1. Carve spanning tree with arc bias
        carveSpanningTree(cells, config, rng);

        // 1b. Open entry holes in ring 0 (so ball can enter maze from center)
        openEntryHoles(cells, config, rng);

        // 2. Remove extra walls for branchiness (prefer arc openings)
        addExtraOpenings(cells, config, params, rng);

        // 3. Aggressively cap radial walls
        capRadialWalls(cells, config, params, rng);

        // 4. Place exit
        const exit = placeExit(cells, config, params, rng);

        // 5. Ensure path from ring 0 to exit is open
        ensurePathToExit(cells, config, exit);

        // 6. Solvability check
        const solution = solveMaze(cells, config, exit);
        if (solution.solvable) {
            return { cells, exit, config, params, finalSeed: seed };
        }

        seed++;
    }

    return generateFallbackMaze(config, params);
}

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

interface Neighbor {
    ring: number;
    slice: number;
    direction: 'inner' | 'outer' | 'cw' | 'ccw';
}

function getNeighbors(ring: number, slice: number, config: MazeConfig): Neighbor[] {
    const neighbors: Neighbor[] = [];
    const { rings, slices } = config;

    if (ring > 0) {
        neighbors.push({ ring: ring - 1, slice, direction: 'inner' });
    }
    if (ring < rings - 1) {
        neighbors.push({ ring: ring + 1, slice, direction: 'outer' });
    }
    neighbors.push({ ring, slice: (slice + 1) % slices, direction: 'cw' });
    neighbors.push({ ring, slice: (slice - 1 + slices) % slices, direction: 'ccw' });

    return neighbors;
}

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
 * Arc-biased DFS: shuffle neighbors but weight CW/CCW directions
 * more heavily so corridors tend to wind around rings — producing
 * the classic circular-maze look instead of radial spokes.
 */
function carveSpanningTree(cells: MazeCell[][], config: MazeConfig, rng: RNG): void {
    const visited = new Set<string>();
    const key = (r: number, s: number) => `${r},${s}`;
    const stack: [number, number][] = [];

    const startR = 0;
    const startS = rng.nextInt(0, config.slices);
    visited.add(key(startR, startS));
    stack.push([startR, startS]);

    while (stack.length > 0) {
        const [cr, cs] = stack[stack.length - 1];
        const neighbors = getNeighbors(cr, cs, config);

        // Build weighted list: repeat arc neighbors ARC_BIAS times
        const weighted: Neighbor[] = [];
        for (const n of neighbors) {
            if (visited.has(key(n.ring, n.slice))) continue;
            const weight = n.direction === 'cw' || n.direction === 'ccw' ? ARC_BIAS : 1;
            for (let w = 0; w < weight; w++) {
                weighted.push(n);
            }
        }

        if (weighted.length === 0) {
            stack.pop();
            continue;
        }

        // Pick a random weighted neighbor
        const chosen = weighted[rng.nextInt(0, weighted.length)];
        visited.add(key(chosen.ring, chosen.slice));
        removeWall(cells, cr, cs, chosen.ring, chosen.slice, chosen.direction);
        stack.push([chosen.ring, chosen.slice]);
    }
}

/**
 * Open 2-3 entry holes in ring 0's inner wall so the ball can
 * fall from the center void into the maze. Holes are spaced
 * evenly around the ring.
 */
function openEntryHoles(cells: MazeCell[][], config: MazeConfig, rng: RNG): void {
    const numHoles = Math.min(3, Math.max(2, Math.floor(config.slices / 4)));
    const spacing = Math.floor(config.slices / numHoles);
    const offset = rng.nextInt(0, config.slices);

    for (let i = 0; i < numHoles; i++) {
        const s = (offset + i * spacing) % config.slices;
        cells[0][s].wallInner = false;
    }
}

/**
 * Add extra openings to create multiple paths. Prefer arc (CW/CCW) openings.
 */
function addExtraOpenings(
    cells: MazeCell[][],
    config: MazeConfig,
    params: GenerationParams,
    rng: RNG,
): void {
    const totalCells = config.rings * config.slices;
    const openingsToAdd = Math.floor(totalCells * params.branchiness * 0.5);

    for (let i = 0; i < openingsToAdd; i++) {
        const r = rng.nextInt(0, config.rings);
        const s = rng.nextInt(0, config.slices);
        const cell = cells[r][s];

        // Prefer opening arc walls (inner/outer) to create ring corridors
        if (rng.next() < 0.7) {
            // Open an arc wall
            if (r > 0 && cell.wallInner && rng.next() < 0.5) {
                removeWall(cells, r, s, r - 1, s, 'inner');
            } else if (r < config.rings - 1 && cell.wallOuter) {
                removeWall(cells, r, s, r + 1, s, 'outer');
            }
        } else {
            // Open a CW/CCW wall
            const ns = (s + 1) % config.slices;
            if (cell.wallCW) {
                removeWall(cells, r, s, r, ns, 'cw');
            }
        }
    }
}

/**
 * Aggressively cap radial walls.
 * Only keep a small fraction of CW walls, and only on even rings.
 */
function capRadialWalls(
    cells: MazeCell[][],
    config: MazeConfig,
    params: GenerationParams,
    rng: RNG,
): void {
    for (let r = 0; r < config.rings; r++) {
        for (let s = 0; s < config.slices; s++) {
            if (!cells[r][s].wallCW) continue;

            // On odd rings, remove ALL radial walls for alternating pattern
            if (r % 2 === 1) {
                const ns = (s + 1) % config.slices;
                cells[r][s].wallCW = false;
                cells[r][ns].wallCCW = false;
                continue;
            }

            // On even rings, keep only radialDensity fraction
            if (rng.next() > params.radialDensity) {
                const ns = (s + 1) % config.slices;
                cells[r][s].wallCW = false;
                cells[r][ns].wallCCW = false;
            }
        }
    }
}

/**
 * Place exit on outer ring.
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

    for (let i = 0; i < sliceCount; i++) {
        const s = (sliceStart + i) % config.slices;
        cells[config.rings - 1][s].wallOuter = false;
    }

    return { sliceStart, sliceCount };
}

/**
 * Ensure there's at least one open radial path from ring 0 to the outer ring
 * at or near the exit slice. This guarantees physical reachability.
 */
function ensurePathToExit(
    cells: MazeCell[][],
    config: MazeConfig,
    exit: ExitSector,
): void {
    // Pick a slice near the exit for the guaranteed radial path
    const targetSlice = exit.sliceStart;

    for (let r = 0; r < config.rings - 1; r++) {
        // If there's no inner-to-outer connection at this slice, open it
        if (cells[r][targetSlice].wallOuter && cells[r + 1][targetSlice].wallInner) {
            cells[r][targetSlice].wallOuter = false;
            cells[r + 1][targetSlice].wallInner = false;
        }
    }
}

function checkGeometricConstraints(config: MazeConfig): boolean {
    const rw = (config.outerRadius - config.innerRadius) / config.rings;
    const minCellHeight = 2 * config.ballRadius + GEOMETRIC_MARGIN;

    if (rw < minCellHeight) return false;

    const innerR = ringInnerRadius(config, 0);
    const arcLen = innerR * sliceAngle(config.slices);
    if (arcLen < minCellHeight) return false;

    return true;
}

function generateFallbackMaze(config: MazeConfig, params: GenerationParams): MazeData {
    const cells = createEmptyGrid(config);

    // Open everything as a spiral path
    for (let r = 0; r < config.rings; r++) {
        // Open all CW walls on this ring (makes a ring corridor)
        for (let s = 0; s < config.slices; s++) {
            const ns = (s + 1) % config.slices;
            cells[r][s].wallCW = false;
            cells[r][ns].wallCCW = false;
        }
        // Open one radial connection to the next ring
        if (r < config.rings - 1) {
            const connectSlice = r % config.slices;
            cells[r][connectSlice].wallOuter = false;
            cells[r + 1][connectSlice].wallInner = false;
        }
    }

    const exit: ExitSector = { sliceStart: 0, sliceCount: 2 };
    cells[config.rings - 1][0].wallOuter = false;
    cells[config.rings - 1][1].wallOuter = false;

    return { cells, exit, config, params, finalSeed: config.seed };
}
