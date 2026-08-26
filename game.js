import './style.css';

const surface = document.querySelector('#game-surface');
const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
const overlay = document.querySelector('#game-overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayMessage = document.querySelector('#overlay-message');
const startButton = document.querySelector('#start-button');
const pauseButton = document.querySelector('#pause-button');
const soundToggle = document.querySelector('#sound-toggle');
const menuButton = document.querySelector('#menu-button');
const inputStatus = document.querySelector('#input-status');
const gameTitle = document.querySelector('#game-title');
const statusDot = document.querySelector('#status-dot');
const scoreLabel = document.querySelector('#score');
const bestScoreLabel = document.querySelector('#best-score');
const levelLabel = document.querySelector('#level');
const livesLabel = document.querySelector('#lives');
const overlayBestLabel = document.querySelector('#overlay-best');
const feedback = document.querySelector('#game-feedback');

let savedBest = 0;
try {
	savedBest = Number(localStorage.getItem('neon-dodge-best') || 0);
} catch {
	savedBest = 0;
}

let savedSound = true;
try {
	savedSound = localStorage.getItem('neon-dodge-sound') !== 'off';
} catch {
	savedSound = true;
}

const state = {
	mode: 'ready', score: 0, level: 1, previousLevel: 1, lives: 3, best: savedBest,
	lastTime: 0, spawnTimer: 0, powerTimer: 0, invulnerable: 0, shield: 0, slowMotion: 0, sound: savedSound,
	keys: { left: false, right: false }, dragging: false
};
const player = { x: 0.5, y: 0.88, width: 22, height: 30, speed: 0.65 };
let obstacles = [];
let powerUps = [];
let particles = [];
const stars = Array.from({ length: 44 }, () => ({ x: Math.random(), y: Math.random(), size: random(0.7, 2), speed: random(0.015, 0.06), alpha: random(0.25, 0.85) }));
let audioContext;

function resizeCanvas() {
	const rect = surface.getBoundingClientRect();
	const ratio = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = rect.width * ratio;
	canvas.height = rect.height * ratio;
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function width() { return surface.clientWidth; }
function height() { return surface.clientHeight; }
function random(min, max) { return min + Math.random() * (max - min); }
function setText(element, value) { element.textContent = value; }

function updateHud() {
	setText(scoreLabel, Math.floor(state.score));
	setText(bestScoreLabel, Math.floor(state.best));
	setText(levelLabel, state.level);
	setText(livesLabel, state.lives);
	setText(overlayBestLabel, Math.floor(state.best));
}

function showFeedback(message, color = '#5ff7dc') {
	feedback.textContent = message;
	feedback.style.color = color;
	feedback.classList.remove('is-visible');
	void feedback.offsetWidth;
	feedback.classList.add('is-visible');
}

function beep(frequency, duration = 0.06) {
	if (!state.sound) return;
	if (!window.AudioContext && !window.webkitAudioContext) return;
	try {
		audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
		if (audioContext.state === 'suspended') audioContext.resume();
	} catch {
		return;
	}
	const oscillator = audioContext.createOscillator();
	const gain = audioContext.createGain();
	oscillator.frequency.value = frequency;
	gain.gain.setValueAtTime(0.045, audioContext.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
	oscillator.connect(gain).connect(audioContext.destination);
	oscillator.start();
	oscillator.stop(audioContext.currentTime + duration);
}

function setMode(mode) {
	state.mode = mode;
	statusDot.className = `status-dot${mode === 'playing' ? ' is-playing' : mode === 'over' ? ' is-over' : ''}`;
	setText(gameTitle, mode === 'playing' ? 'Survive the field' : mode === 'paused' ? 'Game paused' : mode === 'over' ? 'Run complete' : 'Ready for launch');
	pauseButton.disabled = mode !== 'playing' && mode !== 'paused';
	if (mode === 'playing') overlay.classList.add('is-hidden');
	else overlay.classList.remove('is-hidden');
	if (mode === 'ready') { setText(overlayTitle, 'Neon Dodge'); setText(overlayMessage, 'Dodge the falling hazards. Use Arrow keys, A/D, or drag your ship.'); setText(startButton, 'Launch'); }
}

function resetGame() {
	state.score = 0; state.level = 1; state.previousLevel = 1; state.lives = 3; state.spawnTimer = 0; state.powerTimer = 4; state.invulnerable = 0; state.shield = 0; state.slowMotion = 0;
	player.x = 0.5; obstacles = []; powerUps = []; particles = [];
	updateHud();
}

function startGame() {
	if (state.mode === 'ready' || state.mode === 'over') resetGame();
	setMode('playing'); setText(startButton, 'Launch'); setText(inputStatus, 'Dodge, survive, level up.'); beep(520, 0.1);
}

function restartGame() {
	resetGame();
	setMode('playing');
	setText(startButton, 'Launch');
	setText(inputStatus, 'New run started. Dodge, survive, level up.');
	beep(520, 0.1);
}

function togglePause() {
	if (state.mode === 'playing') {
		setMode('paused');
		setText(overlayTitle, 'Paused');
		setText(overlayMessage, 'Take a breath. Your run is waiting.');
		setText(startButton, 'Resume');
		setText(inputStatus, 'Game paused. Press Resume or P to continue.');
	}
	else if (state.mode === 'paused') {
		setMode('playing');
		setText(startButton, 'Launch');
		setText(inputStatus, 'Dodge, survive, level up.');
	}
}

function spawnObstacle() {
	const size = random(14, 30 + state.level * 1.5);
	obstacles.push({ x: random(size, width() - size), y: -size, size, speed: random(90, 135) + state.level * 9, drift: state.level >= 4 && Math.random() < 0.28 ? random(-45, 45) : 0, rotation: random(0, Math.PI), spin: random(-2, 2) });
}

function spawnPowerUp() {
	const types = ['shield', 'slow', 'life'];
	powerUps.push({ type: types[Math.floor(Math.random() * types.length)], x: random(24, width() - 24), y: -18, size: 14, speed: 72 + state.level * 3, phase: random(0, 6) });
}

function circleHit(x, y, radius, targetX, targetY, targetWidth, targetHeight) {
	const closestX = Math.max(targetX, Math.min(x, targetX + targetWidth));
	const closestY = Math.max(targetY, Math.min(y, targetY + targetHeight));
	return Math.hypot(x - closestX, y - closestY) < radius;
}

function burst(x, y, color) {
	for (let index = 0; index < 12; index += 1) particles.push({ x, y, dx: random(-70, 70), dy: random(-70, 70), life: 0.5, color });
}

function collectPowerUp(powerUp) {
	if (powerUp.type === 'shield') state.shield = 7;
	if (powerUp.type === 'slow') state.slowMotion = 6;
	if (powerUp.type === 'life') state.lives = Math.min(5, state.lives + 1);
	const labels = { shield: ['SHIELD!', '#5ff7dc'], slow: ['SLOW MOTION!', '#9b8cff'], life: ['+1 LIFE!', '#ffd166'] };
	beep(powerUp.type === 'life' ? 760 : 640, 0.12); burst(powerUp.x, powerUp.y, powerUp.type === 'shield' ? '#5ff7dc' : '#ffd166'); showFeedback(labels[powerUp.type][0], labels[powerUp.type][1]); updateHud();
}

function hitPlayer() {
	if (state.invulnerable > 0) return;
	if (state.shield > 0) { state.shield = 0; burst(player.x * width(), player.y * height(), '#5ff7dc'); beep(300); return; }
	state.lives -= 1; state.invulnerable = 1.5; surface.classList.remove('is-hit', 'is-damaged'); void surface.offsetWidth; surface.classList.add('is-hit', 'is-damaged'); burst(player.x * width(), player.y * height(), '#ff5c8a'); showFeedback('DAMAGE', '#ff5c8a'); beep(140, 0.2); updateHud();
	if (state.lives <= 0) endGame();
}

function endGame() {
	const newBest = Math.floor(state.score) > state.best;
	state.mode = 'over'; state.best = Math.max(state.best, Math.floor(state.score));
	try { localStorage.setItem('neon-dodge-best', state.best); } catch { /* Storage may be disabled. */ }
	setMode('over'); setText(overlayTitle, newBest ? 'NEW HIGH SCORE!' : 'GAME OVER'); setText(overlayMessage, `SCORE: ${String(Math.floor(state.score)).padStart(4, '0')}  /  LEVEL: ${String(state.level).padStart(2, '0')}`); setText(startButton, 'Play again'); setText(inputStatus, 'The field got you this time.'); updateHud(); showFeedback(newBest ? 'NEW RECORD' : 'RUN ENDED', newBest ? '#ffd166' : '#ff5c8a'); beep(100, 0.35);
}

function update(delta) {
	const timeScale = state.slowMotion > 0 ? 0.48 : 1;
	state.score += delta * 10; state.level = 1 + Math.floor(state.score / 180); state.invulnerable = Math.max(0, state.invulnerable - delta); state.shield = Math.max(0, state.shield - delta); state.slowMotion = Math.max(0, state.slowMotion - delta);
	if (state.level > state.previousLevel) { showFeedback(`LEVEL ${state.level}`, '#9b8cff'); setText(inputStatus, `Level ${state.level}: the field is accelerating.`); beep(880, 0.16); state.previousLevel = state.level; }
	const direction = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0); player.x = Math.max(0.04, Math.min(0.96, player.x + direction * player.speed * delta));
	state.spawnTimer -= delta; state.powerTimer -= delta;
	const spawnEvery = Math.max(0.28, 1.05 - state.level * 0.06);
	if (state.spawnTimer <= 0) { spawnObstacle(); if (state.level > 2 && Math.random() < 0.25) spawnObstacle(); state.spawnTimer = spawnEvery; }
	if (state.powerTimer <= 0) { spawnPowerUp(); state.powerTimer = random(9, 15); }
	obstacles = obstacles.filter((obstacle) => {
		obstacle.y += obstacle.speed * delta * timeScale; obstacle.x += obstacle.drift * delta; obstacle.rotation += obstacle.spin * delta;
		if (circleHit(player.x * width(), player.y * height(), player.width * 0.55, obstacle.x - obstacle.size, obstacle.y - obstacle.size, obstacle.size * 2, obstacle.size * 2)) { hitPlayer(); return false; }
		return obstacle.y < height() + obstacle.size;
	});
	powerUps = powerUps.filter((powerUp) => {
		powerUp.y += powerUp.speed * delta * timeScale; powerUp.phase += delta * 4;
		if (circleHit(player.x * width(), player.y * height(), player.width * 0.6, powerUp.x - powerUp.size, powerUp.y - powerUp.size, powerUp.size * 2, powerUp.size * 2)) { collectPowerUp(powerUp); return false; }
		return powerUp.y < height() + powerUp.size;
	});
	particles = particles.filter((particle) => { particle.x += particle.dx * delta; particle.y += particle.dy * delta; particle.life -= delta; return particle.life > 0; }); updateHud();
}

function draw() {
	const w = width(); const h = height(); context.clearRect(0, 0, w, h);
	context.fillStyle = '#070d22'; context.fillRect(0, 0, w, h);
	stars.forEach((star) => { star.y = (star.y + star.speed * 0.016) % 1; context.globalAlpha = star.alpha; context.fillStyle = star.size > 1.4 ? '#ff7dc4' : '#9b8cff'; context.fillRect(star.x * w, star.y * h, star.size, star.size); });
	context.globalAlpha = 1; context.strokeStyle = 'rgba(95, 247, 220, 0.07)'; context.lineWidth = 1;
	for (let x = 0; x < w; x += 32) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, h); context.stroke(); }
	for (let y = 0; y < h; y += 32) { context.beginPath(); context.moveTo(0, y); context.lineTo(w, y); context.stroke(); }
	obstacles.forEach((obstacle) => { context.save(); context.translate(obstacle.x, obstacle.y); context.rotate(obstacle.rotation); context.shadowBlur = 16; context.shadowColor = '#ff5c8a'; context.fillStyle = '#ff5c8a'; context.fillRect(-obstacle.size, -obstacle.size, obstacle.size * 2, obstacle.size * 2); context.fillStyle = '#220f32'; context.fillRect(-obstacle.size * 0.45, -obstacle.size * 0.45, obstacle.size * 0.9, obstacle.size * 0.9); context.restore(); });
	powerUps.forEach((powerUp) => { const color = powerUp.type === 'shield' ? '#5ff7dc' : powerUp.type === 'slow' ? '#9b8cff' : '#ffd166'; context.save(); context.translate(powerUp.x, powerUp.y); context.rotate(powerUp.phase); context.shadowBlur = 15; context.shadowColor = color; context.strokeStyle = color; context.lineWidth = 3; context.strokeRect(-powerUp.size, -powerUp.size, powerUp.size * 2, powerUp.size * 2); context.restore(); });
	const px = player.x * w; const py = player.y * h; context.save(); context.translate(px, py); context.globalAlpha = state.invulnerable > 0 && Math.floor(state.invulnerable * 10) % 2 ? 0.35 : 1; context.shadowBlur = 20; context.shadowColor = '#5ff7dc'; context.fillStyle = '#e6f7ff'; context.beginPath(); context.moveTo(0, -player.height); context.lineTo(player.width, player.height); context.lineTo(0, player.height * 0.45); context.lineTo(-player.width, player.height); context.closePath(); context.fill(); context.fillStyle = '#5ff7dc'; context.fillRect(-3, -3, 6, 14); if (state.shield > 0) { context.strokeStyle = '#5ff7dc'; context.lineWidth = 2; context.beginPath(); context.arc(0, 0, 30, 0, Math.PI * 2); context.stroke(); } context.restore();
	particles.forEach((particle) => { context.globalAlpha = particle.life * 2; context.fillStyle = particle.color; context.fillRect(particle.x, particle.y, 3, 3); }); context.globalAlpha = 1;
}

function frame(time) { const delta = Math.min((time - state.lastTime) / 1000 || 0, 0.05); state.lastTime = time; if (state.mode === 'playing') update(delta); draw(); requestAnimationFrame(frame); }
function pointerPosition(event) { const rect = surface.getBoundingClientRect(); return Math.max(0.04, Math.min(0.96, (event.clientX - rect.left) / rect.width)); }
function setDirection(direction, active) { state.keys[direction] = active; }

window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', (event) => { if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') setDirection('left', true); if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') setDirection('right', true); if (event.key === ' ' || event.key.toLowerCase() === 'p') { event.preventDefault(); togglePause(); } });
window.addEventListener('keyup', (event) => { if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') setDirection('left', false); if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') setDirection('right', false); });
surface.addEventListener('pointerdown', (event) => {
	if (event.target !== surface && event.target !== canvas) return;
	player.x = pointerPosition(event);
	surface.setPointerCapture(event.pointerId);
});
surface.addEventListener('pointermove', (event) => {
	if (event.pointerType === 'mouse' || surface.hasPointerCapture(event.pointerId)) player.x = pointerPosition(event);
});
surface.addEventListener('pointerup', (event) => {
	if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
});
surface.addEventListener('pointercancel', (event) => {
	if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
});
document.querySelectorAll('.touch-button').forEach((button) => {
	const direction = button.dataset.direction;
	const release = () => setDirection(direction, false);
	button.addEventListener('pointerdown', (event) => {
		event.preventDefault();
		button.setPointerCapture(event.pointerId);
		setDirection(direction, true);
	});
	button.addEventListener('pointerup', release);
	button.addEventListener('pointercancel', release);
	button.addEventListener('lostpointercapture', release);
});
window.addEventListener('pointerup', () => { state.keys.left = false; state.keys.right = false; });
startButton.addEventListener('click', () => { if (state.mode === 'over') restartGame(); else startGame(); }); pauseButton.addEventListener('click', togglePause);
menuButton.addEventListener('click', () => { resetGame(); setMode('ready'); setText(inputStatus, 'Survive as long as you can.'); });
soundToggle.addEventListener('click', () => {
	state.sound = !state.sound;
	soundToggle.textContent = state.sound ? 'Sound on' : 'Sound off';
	soundToggle.setAttribute('aria-pressed', String(state.sound));
	soundToggle.setAttribute('aria-label', state.sound ? 'Turn sound off' : 'Turn sound on');
	try { localStorage.setItem('neon-dodge-sound', state.sound ? 'on' : 'off'); } catch { /* Storage may be disabled. */ }
	if (state.sound) beep(520, 0.08);
});

bestScoreLabel.textContent = state.best;
soundToggle.textContent = state.sound ? 'Sound on' : 'Sound off';
soundToggle.setAttribute('aria-pressed', String(state.sound));
soundToggle.setAttribute('aria-label', state.sound ? 'Turn sound off' : 'Turn sound on');
resizeCanvas(); resetGame(); setMode('ready'); requestAnimationFrame(frame);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }));
