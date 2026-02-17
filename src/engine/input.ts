/**
 * Input manager — tracks key state for instant-stop rotation.
 *
 * Controls:
 *   A / ArrowLeft  → rotate CCW
 *   D / ArrowRight → rotate CW
 *   R              → reset
 *   F1             → toggle debug overlay
 *
 * INSTANT STOP: rotation only while key held. No inertia.
 */

export interface InputState {
    left: boolean;
    right: boolean;
    resetPressed: boolean; // edge-triggered (true for one read)
    debugToggled: boolean; // edge-triggered
}

const keys = new Set<string>();
let resetEdge = false;
let debugEdge = false;

export function initInput(): void {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') {
            resetEdge = true;
            e.preventDefault();
        }
        if (e.key === 'F1') {
            debugEdge = true;
            e.preventDefault();
        }
        keys.add(e.key);
    });

    window.addEventListener('keyup', (e) => {
        keys.delete(e.key);
    });

    // Clear key state on window blur to prevent stuck keys
    window.addEventListener('blur', () => {
        keys.clear();
    });
}

export function readInput(): InputState {
    const state: InputState = {
        left: keys.has('a') || keys.has('A') || keys.has('ArrowLeft'),
        right: keys.has('d') || keys.has('D') || keys.has('ArrowRight'),
        resetPressed: resetEdge,
        debugToggled: debugEdge,
    };
    resetEdge = false;
    debugEdge = false;
    return state;
}
