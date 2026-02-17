/**
 * Debug overlay — toggle with F1.
 *
 * Shows: seed, baseSeed, attemptIndex, rings, slices, wallDensity,
 * corridorWidth, radialDensity, exitSlice, exitWidth, and last attempt metrics.
 */

import type { AttemptMetrics } from '../adapt/metrics.js';

let visible = false;

export function toggleOverlay(): void {
    visible = !visible;
}

export function isOverlayVisible(): boolean {
    return visible;
}

export interface OverlayData {
    seed: number;
    baseSeed: number;
    attemptIndex: number;
    rings: number;
    slices: number;
    wallDensity: number;
    corridorWidth: number;
    radialDensity: number;
    exitSlice: number;
    exitWidth: number;
    lastMetrics: AttemptMetrics | null;
}

export function renderOverlay(ctx: CanvasRenderingContext2D, data: OverlayData): void {
    if (!visible) return;

    const x = 12;
    let y = 20;
    const lineH = 18;

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    const panelH = data.lastMetrics ? lineH * 19 : lineH * 12;
    ctx.fillRect(x - 4, y - 14, 300, panelH);

    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const line = (label: string, value: string | number) => {
        ctx.fillStyle = '#888';
        ctx.fillText(label, x, y);
        ctx.fillStyle = '#ddd';
        ctx.fillText(String(value), x + 150, y);
        y += lineH;
    };

    ctx.fillStyle = '#7c5cbf';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('─── DEBUG (F1) ───', x, y);
    y += lineH;
    ctx.font = '13px monospace';

    line('seed', data.seed);
    line('baseSeed', data.baseSeed);
    line('attemptIndex', data.attemptIndex);
    line('rings', data.rings);
    line('slices', data.slices);
    line('wallDensity', data.wallDensity.toFixed(3));
    line('corridorWidth', data.corridorWidth.toFixed(3));
    line('radialDensity', data.radialDensity.toFixed(3));
    line('exitSlice', data.exitSlice);
    line('exitWidth', data.exitWidth);

    if (data.lastMetrics) {
        y += 4;
        ctx.fillStyle = '#7c5cbf';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('─── LAST ATTEMPT ───', x, y);
        y += lineH;
        ctx.font = '13px monospace';

        const m = data.lastMetrics;
        line('time', m.totalTime.toFixed(1) + 's');
        line('avgSpeed', m.avgSpeed.toFixed(1));
        line('idleRatio', (m.idleRatio * 100).toFixed(1) + '%');
        line('riskRatio', (m.riskRatio * 100).toFixed(1) + '%');
        line('collisions', m.collisionCount);
        line('dirChanges', m.directionChanges);
        line('exploration', (m.exploration * 100).toFixed(1) + '%');
    }
}
