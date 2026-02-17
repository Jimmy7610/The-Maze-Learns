/**
 * Fixed-timestep simulation loop (120Hz physics).
 *
 * Accumulates real delta time and runs physics in fixed steps.
 * Provides interpolation alpha for smooth rendering.
 */

const PHYSICS_HZ = 120;
const FIXED_DT = 1 / PHYSICS_HZ;
const MAX_FRAME_TIME = 0.1; // clamp to avoid spiral of death

export interface TimeState {
    accumulator: number;
    lastTime: number;
    alpha: number; // interpolation factor for rendering
    elapsed: number; // total elapsed game time
}

export function createTimeState(): TimeState {
    return {
        accumulator: 0,
        lastTime: performance.now() / 1000,
        alpha: 0,
        elapsed: 0,
    };
}

/**
 * Advance the time state and call `physicsTick` for each fixed step.
 * Returns the interpolation alpha for rendering.
 */
export function updateTime(
    state: TimeState,
    now: number,
    physicsTick: (dt: number) => void,
): number {
    const currentTime = now / 1000;
    let frameTime = currentTime - state.lastTime;
    state.lastTime = currentTime;

    // Clamp frame time to prevent spiral of death
    if (frameTime > MAX_FRAME_TIME) {
        frameTime = MAX_FRAME_TIME;
    }

    state.accumulator += frameTime;

    while (state.accumulator >= FIXED_DT) {
        physicsTick(FIXED_DT);
        state.accumulator -= FIXED_DT;
        state.elapsed += FIXED_DT;
    }

    state.alpha = state.accumulator / FIXED_DT;
    return state.alpha;
}

export { FIXED_DT, PHYSICS_HZ };
