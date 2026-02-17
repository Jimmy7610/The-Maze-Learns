/**
 * Ball physics — integration, gravity rotation, friction, bounce.
 *
 * All positions in board-local coordinates (maze frame).
 * Gravity direction is rotated by -mazeAngle so the ball "falls"
 * toward the current visual "down" in the rotated maze.
 */

export interface Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
}

// Tuning constants
const GRAVITY = 600; // px/s^2
const FRICTION = 0.985; // velocity multiplier per tick
const RESTITUTION = 0.4; // bounce coefficient
const MAX_SPEED = 800; // px/s cap

export function createBall(x: number, y: number, radius: number): Ball {
    return { x, y, vx: 0, vy: 0, radius };
}

/**
 * Advance ball physics by dt seconds.
 * @param mazeAngle current rotation angle of the maze in radians
 */
export function integrateBall(ball: Ball, dt: number, mazeAngle: number): void {
    // Gravity in board coords: rotate screen-down (0, +G) into maze-local frame.
    // Screen pos = rotate(maze_pos, mazeAngle), so maze-local gravity must be:
    //   gx = G * sin(mazeAngle),  gy = G * cos(mazeAngle)
    // This ensures the ball always falls south on screen regardless of maze rotation.
    const gx = GRAVITY * Math.sin(mazeAngle);
    const gy = GRAVITY * Math.cos(mazeAngle);

    // Semi-implicit Euler
    ball.vx += gx * dt;
    ball.vy += gy * dt;

    // Friction
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;

    // Speed cap
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > MAX_SPEED) {
        const scale = MAX_SPEED / speed;
        ball.vx *= scale;
        ball.vy *= scale;
    }

    // Position integration
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
}

/**
 * Resolve a collision by reflecting the ball velocity along the normal
 * and pushing the ball out of the wall.
 */
export function bounceBall(
    ball: Ball,
    normal: { x: number; y: number },
    penetration: number,
): void {
    // Push out
    ball.x += normal.x * penetration;
    ball.y += normal.y * penetration;

    // Reflect velocity
    const dot = ball.vx * normal.x + ball.vy * normal.y;
    if (dot < 0) {
        ball.vx -= (1 + RESTITUTION) * dot * normal.x;
        ball.vy -= (1 + RESTITUTION) * dot * normal.y;
    }
}

export function resetBall(ball: Ball, x: number, y: number): void {
    ball.x = x;
    ball.y = y;
    ball.vx = 0;
    ball.vy = 0;
}

export { GRAVITY, FRICTION, RESTITUTION, MAX_SPEED };
