// The Maze Learns - Entry Point
// Full implementation in Milestone 3

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resize();
window.addEventListener('resize', resize);

// Placeholder render
ctx.fillStyle = '#0a0a12';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#7c5cbf';
ctx.font = '24px monospace';
ctx.textAlign = 'center';
ctx.fillText('The Maze Learns — scaffold ready', canvas.width / 2, canvas.height / 2);
