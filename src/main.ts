/**
 * The Maze Learns — Main entry point (Milestone 3).
 *
 * Boot → init → game loop (requestAnimationFrame).
 *  Update: read input → rotate angle → physics step → collision → win check.
 *  Render: clear → save → rotate canvas → draw maze → draw ball → restore → draw HUD.
 */

import { createTimeState, updateTime } from './engine/time.js';
import { initInput, readInput } from './engine/input.js';
import { createBall, integrateBall, bounceBall, resetBall } from './engine/physics.js';
import { resolveCollisions } from './engine/collision.js';
import type { Segment } from './engine/collision.js';
import { generateMaze } from './maze/generator.js';
import { buildCollisionSegments, renderMaze } from './maze/renderer.js';
import type { MazeConfig, MazeData, GenerationParams } from './maze/types.js';
import { defaultGenerationParams, sliceAngle, ringOuterRadius } from './maze/types.js';
import { computeAttemptSeed } from './engine/rng.js';
import { renderOverlay, toggleOverlay } from './ui/overlay.js';
import { renderHUD } from './ui/hud.js';
import {
  createMetricsTracker,
  recordTick,
  recordCollision,
  recordDirectionChange,
  snapshotMetrics,
} from './adapt/metrics.js';
import type { AttemptMetrics } from './adapt/metrics.js';
import { createProfile, updateProfile } from './adapt/profile.js';
import { mapProfileToParams } from './adapt/mapping.js';
import type { PlayerProfile } from './adapt/profile.js';

// ─── Constants ───────────────────────────────────────────────

const ROT_SPEED = 2.5; // radians/sec
const BALL_RADIUS = 8;
const INNER_RADIUS = 50;
const WIN_MARGIN = 15;

const MAZE_RINGS = 7;
const MAZE_SLICES = 12;

const BG_COLOR = '#0a0a12';
const BALL_COLOR = '#f0f0f0';
const BALL_GLOW_COLOR = 'rgba(240, 240, 240, 0.3)';

// ─── Game State ──────────────────────────────────────────────

interface GameState {
  maze: MazeData;
  wallSegments: Segment[];
  ball: ReturnType<typeof createBall>;
  mazeAngle: number;
  status: 'playing' | 'won';
  baseSeed: number;
  attemptIndex: number;
  mazeRadius: number;
  lastInput: { left: boolean; right: boolean };
  metricsTracker: ReturnType<typeof createMetricsTracker>;
  lastMetrics: AttemptMetrics | null;
  profile: PlayerProfile;
  genParams: GenerationParams;
}

// ─── Boot ────────────────────────────────────────────────────

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

initInput();

// ─── Initialization ─────────────────────────────────────────

function computeMazeRadius(): number {
  return Math.min(canvas.width, canvas.height) * 0.38;
}

function createMaze(
  baseSeed: number,
  attemptIndex: number,
  params: GenerationParams,
): { maze: MazeData; segments: Segment[] } {
  const mazeRadius = computeMazeRadius();
  const config: MazeConfig = {
    rings: MAZE_RINGS,
    slices: MAZE_SLICES,
    seed: computeAttemptSeed(baseSeed, attemptIndex),
    innerRadius: INNER_RADIUS,
    outerRadius: mazeRadius,
    ballRadius: BALL_RADIUS,
  };
  const maze = generateMaze(config, params);
  const segments = buildCollisionSegments(maze);
  return { maze, segments };
}

function initGame(): GameState {
  const baseSeed = Date.now();
  const profile = createProfile();
  const genParams = defaultGenerationParams();
  const { maze, segments } = createMaze(baseSeed, 0, genParams);
  const ball = createBall(0, 0, BALL_RADIUS);

  return {
    maze,
    wallSegments: segments,
    ball,
    mazeAngle: 0,
    status: 'playing',
    baseSeed,
    attemptIndex: 0,
    mazeRadius: computeMazeRadius(),
    lastInput: { left: false, right: false },
    metricsTracker: createMetricsTracker(maze.config),
    lastMetrics: null,
    profile,
    genParams,
  };
}

let game = initGame();
const timeState = createTimeState();

// ─── Reset ──────────────────────────────────────────────────

function resetGame(state: GameState): void {
  state.attemptIndex++;

  // Update profile and get new params based on metrics
  if (state.lastMetrics) {
    updateProfile(state.profile, state.lastMetrics);
    state.genParams = mapProfileToParams(state.profile, state.genParams);
  }

  state.mazeRadius = computeMazeRadius();
  const { maze, segments } = createMaze(state.baseSeed, state.attemptIndex, state.genParams);
  state.maze = maze;
  state.wallSegments = segments;
  resetBall(state.ball, 0, 0);
  state.mazeAngle = 0;
  state.status = 'playing';
  state.metricsTracker = createMetricsTracker(maze.config);
}

// ─── Win Check ──────────────────────────────────────────────

function checkWin(state: GameState): boolean {
  const { ball, maze } = state;
  const dist = Math.sqrt(ball.x * ball.x + ball.y * ball.y);
  const outerR = ringOuterRadius(maze.config, maze.config.rings - 1);

  if (dist <= outerR + WIN_MARGIN) return false;

  // Check if ball's angle falls within the exit sector
  let theta = Math.atan2(ball.y, ball.x);
  if (theta < 0) theta += 2 * Math.PI;

  const sa = sliceAngle(maze.config.slices);
  const exitStart = maze.exit.sliceStart * sa;
  const exitEnd = (maze.exit.sliceStart + maze.exit.sliceCount) * sa;

  // Handle wrap-around
  if (exitEnd > 2 * Math.PI) {
    return theta >= exitStart || theta <= exitEnd - 2 * Math.PI;
  }

  return theta >= exitStart && theta <= exitEnd;
}

// ─── Game Loop ──────────────────────────────────────────────

function physicsTick(dt: number): void {
  if (game.status !== 'playing') return;

  const input = readInput();

  // Handle debug toggle
  if (input.debugToggled) {
    toggleOverlay();
  }

  // Handle reset
  if (input.resetPressed) {
    game.lastMetrics = snapshotMetrics(game.metricsTracker);
    resetGame(game);
    return;
  }

  // Rotation — INSTANT STOP: only rotate while key held
  const prevLeft = game.lastInput.left;
  const prevRight = game.lastInput.right;

  if (input.left) {
    game.mazeAngle -= ROT_SPEED * dt;
  }
  if (input.right) {
    game.mazeAngle += ROT_SPEED * dt;
  }

  // Detect direction changes for metrics
  if ((input.left && !prevLeft) || (input.right && !prevRight)) {
    recordDirectionChange(game.metricsTracker);
  }

  game.lastInput = { left: input.left, right: input.right };

  // Physics
  integrateBall(game.ball, dt, game.mazeAngle);

  // Collisions
  const collisions = resolveCollisions(game.ball, game.wallSegments, bounceBall);
  if (collisions > 0) {
    recordCollision(game.metricsTracker);
  }

  // Record metrics
  recordTick(game.metricsTracker, game.ball, game.mazeAngle, dt);

  // Win check
  if (checkWin(game)) {
    game.status = 'won';
    game.lastMetrics = snapshotMetrics(game.metricsTracker);
  }
}

function render(): void {
  const w = canvas.width;
  const h = canvas.height;

  // Clear
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  // Draw maze (rotated)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(game.mazeAngle);
  renderMaze(ctx, game.maze);
  ctx.restore();

  // Draw ball (at its board position, rotated to screen)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(game.mazeAngle);

  // Glow
  ctx.beginPath();
  ctx.arc(game.ball.x, game.ball.y, game.ball.radius * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = BALL_GLOW_COLOR;
  ctx.fill();

  // Ball
  ctx.beginPath();
  ctx.arc(game.ball.x, game.ball.y, game.ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = BALL_COLOR;
  ctx.fill();

  ctx.restore();

  // HUD
  renderHUD(ctx, {
    angle: game.mazeAngle,
    status: game.status,
    attemptIndex: game.attemptIndex,
    canvasWidth: w,
    canvasHeight: h,
  });

  // Debug overlay
  renderOverlay(ctx, {
    seed: game.maze.finalSeed,
    baseSeed: game.baseSeed,
    attemptIndex: game.attemptIndex,
    rings: game.maze.config.rings,
    slices: game.maze.config.slices,
    wallDensity: game.genParams.wallDensity,
    corridorWidth: game.genParams.corridorWidth,
    radialDensity: game.genParams.radialDensity,
    exitSlice: game.maze.exit.sliceStart,
    exitWidth: game.maze.exit.sliceCount,
    lastMetrics: game.lastMetrics,
  });

  // Win overlay
  if (game.status === 'won') {
    drawWinOverlay(ctx, w, h);
  }
}

function drawWinOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YOU ESCAPED!', w / 2, h / 2 - 30);

  ctx.fillStyle = '#aaa';
  ctx.font = '20px monospace';
  ctx.fillText('Press R to play again', w / 2, h / 2 + 30);
}

function gameLoop(now: number): void {
  // Handle inputs even when won (for reset/debug)
  if (game.status === 'won') {
    const input = readInput();
    if (input.debugToggled) toggleOverlay();
    if (input.resetPressed) {
      resetGame(game);
    }
  }

  updateTime(timeState, now, physicsTick);
  render();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
