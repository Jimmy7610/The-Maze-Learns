/**
 * Minimal HUD — angle, status, attempt count.
 */

export interface HUDData {
    angle: number; // radians
    status: 'playing' | 'won';
    attemptIndex: number;
    canvasWidth: number;
    canvasHeight: number;
}

export function renderHUD(ctx: CanvasRenderingContext2D, data: HUDData): void {
    const { canvasWidth: w, canvasHeight: h } = data;

    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '14px monospace';

    // Angle display
    const degrees = ((data.angle * 180) / Math.PI) % 360;
    ctx.fillStyle = '#666';
    ctx.fillText(`∠ ${degrees.toFixed(1)}°`, w - 16, 16);

    // Attempt counter
    ctx.fillText(`Attempt #${data.attemptIndex + 1}`, w - 16, 36);

    // Status indicator
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '13px monospace';
    ctx.fillStyle = '#555';

    if (data.status === 'playing') {
        ctx.fillText('A/D or ←/→ to rotate · R to reset · F1 debug', w / 2, h - 12);
    }
}
