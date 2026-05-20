const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const STORAGE_KEY = 'pomodoroSessions';
const PROGRESS_RADIUS = 108;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

const state = {
  mode: 'work',
  remainingSeconds: WORK_DURATION,
  duration: WORK_DURATION,
  intervalId: null,
  isRunning: false,
  isPaused: false,
  audioContext: null,
  sessionCount: 0,
};

function initialApp() {
  const dom = getDomElements();
  bindUiEvents(dom);
  state.sessionCount = loadSessionCount();
  updateSessionDisplay();
  dom.progressCircle.style.strokeDasharray = PROGRESS_CIRCUMFERENCE;
  dom.progressCircle.style.strokeDashoffset = 0;
  setMode('work', false);
}

function getDomElements() {
  return {
    timerText: document.getElementById('timerText'),
    phaseLabel: document.getElementById('phaseLabel'),
    startButton: document.getElementById('startButton'),
    pauseButton: document.getElementById('pauseButton'),
    resumeButton: document.getElementById('resumeButton'),
    resetButton: document.getElementById('resetButton'),
    resetSessionsButton: document.getElementById('resetSessionsButton'),
    sessionCounter: document.getElementById('sessionCounter'),
    progressRing: document.getElementById('progressRing'),
    progressCircle: document.getElementById('progressCircle'),
  };
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateDisplay(seconds) {
  const dom = getDomElements();
  dom.timerText.textContent = formatTime(seconds);
  dom.phaseLabel.textContent = state.mode === 'work' ? 'Work Session' : 'Break Time';
  dom.progressRing.dataset.mode = state.mode;
}

function updateProgress(secondsElapsed, duration) {
  const dom = getDomElements();
  const progressFraction = Math.min(Math.max(secondsElapsed / duration, 0), 1);
  dom.progressCircle.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE * progressFraction;
}

function setMode(mode, autoStart = true) {
  state.mode = mode;
  state.duration = mode === 'work' ? WORK_DURATION : BREAK_DURATION;
  state.remainingSeconds = state.duration;
  updateDisplay(state.remainingSeconds);
  updateProgress(0, state.duration);
  state.isPaused = false;
  state.isRunning = false;
  clearInterval(state.intervalId);
  state.intervalId = null;
  updateButtons();

  if (autoStart) {
    startTimer();
  }
}

function startTimer() {
  if (state.isRunning) {
    return;
  }

  ensureAudioContext();

  if (state.isPaused) {
    resumeTimer();
    return;
  }

  state.isRunning = true;
  state.isPaused = false;
  updateButtons();

  if (!state.intervalId) {
    state.intervalId = setInterval(tick, 1000);
  }
}

function pauseTimer() {
  if (!state.isRunning) {
    return;
  }

  state.isRunning = false;
  state.isPaused = true;
  clearInterval(state.intervalId);
  state.intervalId = null;
  updateButtons();
}

function resumeTimer() {
  if (state.isRunning || !state.isPaused) {
    return;
  }

  ensureAudioContext();
  state.isRunning = true;
  state.isPaused = false;
  state.intervalId = setInterval(tick, 1000);
  updateButtons();
}

function resetTimer() {
  state.isRunning = false;
  state.isPaused = false;
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.remainingSeconds = state.duration;
  updateDisplay(state.remainingSeconds);
  updateProgress(0, state.duration);
  updateButtons();
}

function resetSessions() {
  state.sessionCount = 0;
  saveSessionCount(state.sessionCount);
  updateSessionDisplay();
}

function tick() {
  if (state.remainingSeconds <= 0) {
    return;
  }

  state.remainingSeconds -= 1;
  updateDisplay(state.remainingSeconds);
  updateProgress(state.duration - state.remainingSeconds, state.duration);

  if (state.remainingSeconds <= 0) {
    completePeriod();
  }
}

function completePeriod() {
  clearInterval(state.intervalId);
  state.intervalId = null;
  state.isRunning = false;
  state.isPaused = false;

  const wasWork = state.mode === 'work';

  if (wasWork) {
    incrementSessionCount();
  }

  playTransitionSound(wasWork ? 'workToBreak' : 'breakToWork');

  state.mode = wasWork ? 'break' : 'work';
  state.duration = state.mode === 'work' ? WORK_DURATION : BREAK_DURATION;
  state.remainingSeconds = state.duration;
  updateDisplay(state.remainingSeconds);
  updateProgress(0, state.duration);
  state.isRunning = true;
  state.intervalId = setInterval(tick, 1000);
  updateButtons();
}

function playTransitionSound(type) {
  if (!(window.AudioContext || window.webkitAudioContext)) {
    return;
  }

  ensureAudioContext();

  const ctx = state.audioContext;
  if (!ctx) {
    return;
  }

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = type === 'workToBreak' ? 920 : 560;
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.2);
}

function ensureAudioContext() {
  if (state.audioContext) {
    if (state.audioContext.state === 'suspended') {
      state.audioContext.resume().catch(() => {});
    }
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }

  state.audioContext = new AudioContext();
  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume().catch(() => {});
  }
}

function loadSessionCount() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const count = Number(stored);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function saveSessionCount(count) {
  localStorage.setItem(STORAGE_KEY, String(count));
}

function incrementSessionCount() {
  state.sessionCount += 1;
  saveSessionCount(state.sessionCount);
  updateSessionDisplay();
}

function updateSessionDisplay() {
  const dom = getDomElements();
  dom.sessionCounter.textContent = String(state.sessionCount);
}

function updateButtons() {
  const dom = getDomElements();
  dom.pauseButton.disabled = !state.isRunning;
  dom.resumeButton.disabled = !state.isPaused;
  dom.startButton.disabled = state.isRunning;
}

function bindUiEvents(dom) {
  if (!dom) {
    dom = getDomElements();
  }

  dom.startButton.addEventListener('click', startTimer);
  dom.pauseButton.addEventListener('click', pauseTimer);
  dom.resumeButton.addEventListener('click', resumeTimer);
  dom.resetButton.addEventListener('click', resetTimer);
  dom.resetSessionsButton.addEventListener('click', resetSessions);
}

window.addEventListener('DOMContentLoaded', initialApp);
