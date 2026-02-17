/**
 * Maze solver — BFS solvability check.
 *
 * Operates on the cell graph: if there's no wall between adjacent cells,
 * they are connected. BFS from any inner ring cell to the exit sector cells.
 */

import type { MazeCell, MazeConfig, ExitSector } from './types.js';

export interface SolveResult {
    solvable: boolean;
    path: [number, number][]; // [(ring, slice), ...]
}

/**
 * BFS from all ring-0 cells to exit sector on the outer ring.
 */
export function solveMaze(
    cells: MazeCell[][],
    config: MazeConfig,
    exit: ExitSector,
): SolveResult {
    const { rings, slices } = config;
    const key = (r: number, s: number) => r * slices + s;

    // Build exit target set
    const exitCells = new Set<number>();
    for (let i = 0; i < exit.sliceCount; i++) {
        const s = (exit.sliceStart + i) % slices;
        exitCells.add(key(rings - 1, s));
    }

    // BFS from center (ring 0, all slices are potential starts since ball is at center)
    const visited = new Map<number, number>(); // cell key -> parent key
    const queue: [number, number][] = [];

    // Start from all ring-0 cells (ball starts at center, can reach any ring-0 cell)
    for (let s = 0; s < slices; s++) {
        const k = key(0, s);
        visited.set(k, -1);
        queue.push([0, s]);
    }

    let head = 0;
    while (head < queue.length) {
        const [cr, cs] = queue[head++];
        const ck = key(cr, cs);

        // Check if we've reached an exit cell AND its outer wall is open
        if (exitCells.has(ck) && !cells[cr][cs].wallOuter) {
            // Reconstruct path
            const path: [number, number][] = [];
            let current = ck;
            while (current !== -1) {
                const r = Math.floor(current / slices);
                const s = current % slices;
                path.unshift([r, s]);
                current = visited.get(current) ?? -1;
            }
            return { solvable: true, path };
        }

        // Explore neighbors
        const cell = cells[cr][cs];

        // Inner neighbor
        if (cr > 0 && !cell.wallInner) {
            const nk = key(cr - 1, cs);
            if (!visited.has(nk)) {
                visited.set(nk, ck);
                queue.push([cr - 1, cs]);
            }
        }

        // Outer neighbor
        if (cr < rings - 1 && !cell.wallOuter) {
            const nk = key(cr + 1, cs);
            if (!visited.has(nk)) {
                visited.set(nk, ck);
                queue.push([cr + 1, cs]);
            }
        }

        // CW neighbor
        if (!cell.wallCW) {
            const ns = (cs + 1) % slices;
            const nk = key(cr, ns);
            if (!visited.has(nk)) {
                visited.set(nk, ck);
                queue.push([cr, ns]);
            }
        }

        // CCW neighbor
        if (!cell.wallCCW) {
            const ns = (cs - 1 + slices) % slices;
            const nk = key(cr, ns);
            if (!visited.has(nk)) {
                visited.set(nk, ck);
                queue.push([cr, ns]);
            }
        }
    }

    return { solvable: false, path: [] };
}
