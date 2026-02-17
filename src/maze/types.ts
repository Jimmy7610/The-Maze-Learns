/**
 * Maze type definitions — circular maze model.
 *
 * Structure: rings × slices. Each cell has walls on inner, outer, CW, CCW sides.
 * The center is a void (inner radius), not a cell.
 *
 * Coordinate system: (ring, slice) where ring 0 is innermost ring,
 * and slice 0 starts at angle 0, progressing counter-clockwise.
 */

export interface MazeCell {
    ring: number;
    slice: number;
    /** Wall on inner arc (toward center) */
    wallInner: boolean;
    /** Wall on outer arc (toward exterior) */
    wallOuter: boolean;
    /** Clockwise radial wall */
    wallCW: boolean;
    /** Counter-clockwise radial wall */
    wallCCW: boolean;
}

export interface ExitSector {
    /** Starting slice index of exit (inclusive) */
    sliceStart: number;
    /** Number of slices in exit opening (>=1, >=2 for easier configs) */
    sliceCount: number;
}

export interface MazeConfig {
    /** Number of concentric rings */
    rings: number;
    /** Number of angular slices */
    slices: number;
    /** PRNG seed for this maze */
    seed: number;
    /** Inner void radius in pixels */
    innerRadius: number;
    /** Outer maze radius in pixels */
    outerRadius: number;
    /** Ball radius for geometric constraint checks */
    ballRadius: number;
}

export interface GenerationParams {
    /** 0…1: how many extra walls to add beyond the spanning tree */
    wallDensity: number;
    /** 0…1: how branchy the maze is (higher = more forks) */
    branchiness: number;
    /** Minimum corridor width multiplier (>= 1.0) */
    corridorWidth: number;
    /** 0…1: fraction of radial walls allowed (cap for visual style) */
    radialDensity: number;
    /** 0…1: how many dead-end decoy paths to add */
    decoyRate: number;
    /** How long the optimal path should be (0…1, fraction of grid) */
    pathLengthBias: number;
    /** Offset for exit placement (slice index, -1 = random) */
    exitOffset: number;
    /** Number of exit slices (1 or 2) */
    exitWidth: number;
}

export function defaultGenerationParams(): GenerationParams {
    return {
        wallDensity: 0.3,
        branchiness: 0.3,
        corridorWidth: 1.0,
        radialDensity: 0.2,
        decoyRate: 0.2,
        pathLengthBias: 0.5,
        exitOffset: -1,
        exitWidth: 2,
    };
}

export interface MazeData {
    cells: MazeCell[][];
    exit: ExitSector;
    config: MazeConfig;
    params: GenerationParams;
    /** Final seed actually used (may differ if generation retried) */
    finalSeed: number;
}

/**
 * Get the angular extent of a single slice in radians.
 */
export function sliceAngle(slices: number): number {
    return (2 * Math.PI) / slices;
}

/**
 * Get the inner radius of a given ring.
 */
export function ringInnerRadius(config: MazeConfig, ring: number): number {
    const ringWidth = (config.outerRadius - config.innerRadius) / config.rings;
    return config.innerRadius + ring * ringWidth;
}

/**
 * Get the outer radius of a given ring.
 */
export function ringOuterRadius(config: MazeConfig, ring: number): number {
    const ringWidth = (config.outerRadius - config.innerRadius) / config.rings;
    return config.innerRadius + (ring + 1) * ringWidth;
}

/**
 * Get the ring width (all rings are equal width).
 */
export function ringWidth(config: MazeConfig): number {
    return (config.outerRadius - config.innerRadius) / config.rings;
}
