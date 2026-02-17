import { describe, it, expect } from 'vitest';
import { generateMaze } from '../src/maze/generator.js';
import { solveMaze } from '../src/maze/solver.js';
import { defaultGenerationParams } from '../src/maze/types.js';
import type { MazeConfig, GenerationParams } from '../src/maze/types.js';

function makeConfig(overrides: Partial<MazeConfig> = {}): MazeConfig {
    return {
        rings: 4,
        slices: 8,
        seed: 42,
        innerRadius: 30,
        outerRadius: 200,
        ballRadius: 6,
        ...overrides,
    };
}

describe('Maze Solver', () => {
    it('generated mazes are always solvable (50 seeds)', () => {
        const params = defaultGenerationParams();
        for (let seed = 0; seed < 50; seed++) {
            const config = makeConfig({ seed });
            const maze = generateMaze(config, params);
            const result = solveMaze(maze.cells, maze.config, maze.exit);
            expect(result.solvable).toBe(true);
        }
    });

    it('solvable with varied ring/slice configs', () => {
        const params = defaultGenerationParams();
        const configs: [number, number][] = [
            [2, 4],
            [3, 6],
            [5, 10],
            [6, 12],
            [4, 16],
        ];

        for (const [rings, slices] of configs) {
            for (let seed = 0; seed < 10; seed++) {
                const config = makeConfig({ rings, slices, seed });
                const maze = generateMaze(config, params);
                const result = solveMaze(maze.cells, maze.config, maze.exit);
                expect(result.solvable).toBe(true);
            }
        }
    });

    it('path starts from ring 0 and ends at outermost ring', () => {
        const params = defaultGenerationParams();
        const config = makeConfig({ seed: 123 });
        const maze = generateMaze(config, params);
        const result = solveMaze(maze.cells, maze.config, maze.exit);

        expect(result.solvable).toBe(true);
        expect(result.path.length).toBeGreaterThan(0);
        expect(result.path[0][0]).toBe(0); // starts at ring 0
        expect(result.path[result.path.length - 1][0]).toBe(config.rings - 1); // ends at outer ring
    });

    it('high wall density still produces solvable mazes', () => {
        const params: GenerationParams = {
            ...defaultGenerationParams(),
            wallDensity: 0.9,
            branchiness: 0.1,
        };
        for (let seed = 0; seed < 20; seed++) {
            const config = makeConfig({ seed, rings: 4, slices: 8 });
            const maze = generateMaze(config, params);
            const result = solveMaze(maze.cells, maze.config, maze.exit);
            expect(result.solvable).toBe(true);
        }
    });

    it('exit sector has open outer walls', () => {
        const params = defaultGenerationParams();
        const config = makeConfig({ seed: 77 });
        const maze = generateMaze(config, params);

        for (let i = 0; i < maze.exit.sliceCount; i++) {
            const s = (maze.exit.sliceStart + i) % config.slices;
            expect(maze.cells[config.rings - 1][s].wallOuter).toBe(false);
        }
    });
});
