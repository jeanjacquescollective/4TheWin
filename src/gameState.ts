import {
  GameState,
  GameBoard,
  Player,
  GameConfig,
  ActiveDisc,
  PreviewDisc,
  AnimatingDisc,
  WinningPosition,
  DiscType,
  Explosion
} from './types';
import { createGameBoard } from './gameLogic';
import { progress } from './uiElements';

// Game status and tracking
export let appState: GameState = "landing";
export let thumbUpTime: number = 0;
export const requiredThumbTime: number = 2000; // 2 seconds in milliseconds
export let progressBarWidth: number = 0;
export let gameOver: boolean = false;
export let winningPositions: WinningPosition[] | null = null;
export let winTimer: number = 0;
export const winTimerDuration: number = 10000; // 15 seconds in milliseconds

// Bomb tracking
export let playerBombs: { [key in Player]: number } = { 1: 1, 2: 1 }; // Each player starts with 1 bomb
export let bombSelected: boolean = false; // Is bomb currently selected
export let explosions: Explosion[] = []; // Track ongoing explosions

/**
 * Set the app state
 */
export function setAppState(state: GameState): void {
  appState = state;
}

/**
 * Set the game over state
 */
export function setGameOver(value: boolean): void {
  gameOver = value;
}

/**
 * Set the winning positions
 */
export function setWinningPositions(positions: WinningPosition[] | null): void {
  winningPositions = positions;
}

/**
 * Update the win timer
 */
export function updateWinTimer(deltaTime: number): number {
  winTimer += deltaTime;
  return winTimer;
}

/**
 * Reset the win timer
 */
export function resetWinTimer(): void {
  winTimer = 0;
}

// Game state
export let currentPlayer: Player = 1; // 1 for red, 2 for blue
export let gameBoard: GameBoard;
export let discRotations: (number | null)[][]; // Store rotation angles for each disc
export let discTypes: (DiscType | null)[][]; // Store disc types (normal or bomb)
export let animatingDiscs: AnimatingDisc[] = [];

// Active disc that can be moved
export let activeDisc: ActiveDisc;

// Preview disc that shows where the active disc will land
export let previewDisc: PreviewDisc;

// Bomb image reference
export let bombImage: HTMLImageElement | null = null;

/**
 * Initialize the game state
 */
export function initializeGameState(gameConfig: GameConfig, canvasWidth: number): void {
  gameBoard = createGameBoard(gameConfig.rows, gameConfig.cols);
  discRotations = Array(gameConfig.rows).fill(null).map(() => Array(gameConfig.cols).fill(null));
  discTypes = Array(gameConfig.rows).fill(null).map(() => Array(gameConfig.cols).fill(null));
  
  // Position red discs on the right side
  const discX = currentPlayer === 1 ? 
    canvasWidth * 0.75 : // Right side for red
    canvasWidth * 0.25;  // Left side for blue
  
  activeDisc = { 
    x: discX, 
    y: gameConfig.cellSize / 2, 
    radius: gameConfig.discRadius, 
    isGrabbed: false,
    color: "#ef7d00",
    type: "normal" // Start with normal disc
  };
  
  previewDisc = {
    x: 0,
    y: 0,
    row: -1,
    col: -1,
    radius: gameConfig.discRadius,
    visible: false,
    color: "rgba(0, 0, 0, 0)", // Will be set based on current player with transparency
    type: "normal"
  };
  
  // Reset bombs
  playerBombs = { 1: 1, 2: 1 };
  bombSelected = false;
  explosions = [];
  
  // Load bomb image
  loadBombImage();
}

/**
 * Load the bomb image
 */
function loadBombImage(): void {
  bombImage = new Image();
  bombImage.src = 'images/bomb.png';
  
  bombImage.onerror = () => {
    console.error('Error loading bomb image');
    bombImage = null;
  };
}

/**
 * Reset the game state
 */
export function resetGame(gameConfig: GameConfig, canvasWidth: number): void {
  gameBoard = createGameBoard(gameConfig.rows, gameConfig.cols);
  discRotations = Array(gameConfig.rows).fill(null).map(() => Array(gameConfig.cols).fill(null));
  discTypes = Array(gameConfig.rows).fill(null).map(() => Array(gameConfig.cols).fill(null));
  gameOver = false;
  currentPlayer = 1;
  animatingDiscs = []; // Clear any animating discs
  winningPositions = null; // Reset winning positions
  resetWinTimer(); // Reset the win timer
  
  // Reset bombs
  playerBombs = { 1: 1, 2: 1 };
  bombSelected = false;
  explosions = [];
  
  activeDisc = { 
    x: canvasWidth * 0.75, // Start with orange on the right side
    y: gameConfig.cellSize / 2, 
    radius: gameConfig.discRadius, 
    isGrabbed: false,
    color: "#ef7d00",
    type: "normal"
  };
}

/**
 * Start the game after landing page verification
 */
export function startGame(): void {
  appState = "game";
  thumbUpTime = 0;
  progressBarWidth = 0;
}

/**
 * Switch to the next player
 */
export function switchPlayer(canvasWidth: number): void {
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  
  // Position the new disc based on the player:
  // Red (Player 1) on the right, Blue (Player 2) on the left
  const newX = currentPlayer === 1 ? 
    canvasWidth * 0.75 : // Right side for red
    canvasWidth * 0.25;  // Left side for blue
  
  // Update active disc color and position based on current player
  activeDisc.color = currentPlayer === 1 ? "#ef7d00" : "#009ad4";
  activeDisc.x = newX;
  activeDisc.y = activeDisc.radius+5; // Reset vertical position too
  
  // Reset to normal disc when switching player
  bombSelected = false;
  activeDisc.type = "normal";
}

/**
 * Toggle between normal disc and bomb
 */
export function toggleBomb(): boolean {
  // Can only toggle if player has bombs available
  if (playerBombs[currentPlayer] > 0) {
    bombSelected = !bombSelected;
    activeDisc.type = bombSelected ? "bomb" : "normal";
    previewDisc.type = activeDisc.type;
    return true;
  }
  return false;
}

/**
 * Use a bomb
 */
export function useBomb(): void {
  if (playerBombs[currentPlayer] > 0) {
    playerBombs[currentPlayer]--;
    bombSelected = false; // Reset selection after use
  }
}

/**
 * Add an explosion
 */
export function addExplosion(x: number, y: number, player: Player): void {
  const color = player === 1 ? "#ff7700" : "#00a2ff";
  explosions.push({
    x,
    y,
    radius: 0,
    maxRadius: 80, // Max explosion radius
    alpha: 1,
    color,
    player
  });
}

/**
 * Update explosions
 */
export function updateExplosions(deltaTime: number): void {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const explosion = explosions[i];
    
    // Increase radius
    explosion.radius += deltaTime * 0.2;
    
    // Decrease alpha as explosion grows
    explosion.alpha = Math.max(0, 1 - (explosion.radius / explosion.maxRadius));
    
    // Remove completed explosions
    if (explosion.radius >= explosion.maxRadius) {
      explosions.splice(i, 1);
    }
  }
}

/**
 * Add an animating disc to the game state
 */
export function addAnimatingDisc(disc: AnimatingDisc): void {
  animatingDiscs.push(disc);
}

/**
 * Remove an animating disc from the array
 */
export function removeAnimatingDisc(index: number): void {
  animatingDiscs.splice(index, 1);
}

/**
 * Update the progress bar for landing page
 */
export function updateThumbProgress(deltaTime: number): void {
  thumbUpTime += deltaTime;
  progressBarWidth = Math.min(thumbUpTime / requiredThumbTime, 1);
  if (progress) {
    progress.style.width = `${progressBarWidth * 100}%`;
  }
}

/**
 * Reset the thumb progress
 */
export function resetThumbProgress(): void {
  thumbUpTime = 0;
  progressBarWidth = 0;
  if (progress) {
    progress.style.width = `${progressBarWidth * 100}%`;
  }
}

/**
 * Check if thumb progress is complete
 */
export function isThumbProgressComplete(): boolean {
  return thumbUpTime >= requiredThumbTime;
}removeAnimatingDisc