window.addEventListener('resize', handleResize);

import {
  gameConfig,
  dimensions,
  initialize,
  setupDimensions,
} from './setup';

import {
  playPlaceSound,
  playWinSound,
  playStartSound,
  playGrabSound,
  playExplosionSound
} from './audio';

import {
  appState,
  gameOver,
  currentPlayer,
  gameBoard,
  discRotations,
  discTypes,
  animatingDiscs,
  activeDisc,
  previewDisc,
  resetGame,
  startGame,
  switchPlayer,
  addAnimatingDisc,
  removeAnimatingDisc,
  updateThumbProgress,
  resetThumbProgress,
  isThumbProgressComplete,
  setGameOver,
  setWinningPositions,
  updateWinTimer,
  winTimerDuration,
  setAppState,
  toggleBomb,
  useBomb,

  addExplosion,
  updateExplosions,
  
} from './gameState';

import {
  checkWin,
  updateAnimatingDisc,
  resetPreviewDisc,
  updatePreviewDisc,
  dropDisc,
  processBombExplosion,
  applyGravityAfterBombing,
  getBoardStartX,
  getBoardStartY
} from './gameLogic';

import {
  processVideoFrame,
  setupWebcam,
  updateTimestamp,
  processHandGestures
} from './gestureRecognition';

import {
  drawLandingPage,
  drawGameBoard,
  drawActiveDisc,
  drawPreviewDisc,
  drawAnimatingDisc,
  drawGameStatus,
} from './rendering';
import { currentPlayerTextElement, endGameText, gameElements, introElements } from './uiElements';

// DOM Elements
const video = document.getElementById("webcam") as HTMLVideoElement;
const canvasElement = document.getElementById("output_canvas") as HTMLCanvasElement;
const canvasCtx = canvasElement.getContext("2d");

// Game status tracking
let webcamRunning: boolean = false;
let bombDropped: boolean = false;
let gravityApplied: boolean = false;
let bombTimer: number = 0;

// Initialize and start game
window.addEventListener('load', () => {
  console.log("Window loaded, initializing game...");
  initialize(video, canvasElement)
    .then(() => {
      console.log("Game initialized, enabling webcam...");
      enableCam();
    })
    .catch(error => {
      console.error("Error initializing game:", error);
      // Show error on screen for debugging
      if (canvasCtx!) {
        canvasCtx!.fillStyle = "white";
        canvasCtx!.font = "20px Arial";
        canvasCtx!.fillText(`Initialization error: ${error.message}`, 20, 40);
      }
    });
});

/**
 * Handle window resize
 */
function handleResize() {
  setupDimensions(video, canvasElement);
  resetGame(gameConfig, dimensions.canvasWidth);
}

/**
 * Enable webcam access
 */
function enableCam() {
  if (!webcamRunning) {
    webcamRunning = true;
  }

  setupWebcam(video, predictWebcam);
}

/**
 * Main game loop
 */
async function predictWebcam() {
  try {
    const deltaTime = updateTimestamp();
    const results = await processVideoFrame(video, Date.now());

    // Handle current app state
    if (appState === "landing") {
      handleLandingState(results, deltaTime);
    } else if (appState === "game") {
      handleGameState(results, deltaTime);
    }

    if (webcamRunning) {
      document.querySelector('#loading-screen')?.classList.add('loading-screen--hidden')
      window.requestAnimationFrame(predictWebcam);
    }
  } catch (error) {
    console.error("Error in game loop:", error);
    // Display error on screen
    if (canvasCtx!) {
      canvasCtx!.fillStyle = "white";
      canvasCtx!.font = "20px Arial";
      const errorMessage = (error as Error).message;
      canvasCtx!.fillText(`Game error: ${errorMessage}`, 20, 70);
      
      // Try to continue the game loop
      if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
      }
    }
  }
}

/**
 * Handle landing page state
 */
function handleLandingState(results: any, deltaTime: number) {
  drawLandingPage(
    canvasCtx!, 
    dimensions.canvasWidth, 
    dimensions.canvasHeight, 
  );
  
  // Check for thumb up gesture
  if (results && results.gestures && results.gestures.length > 0) {
    const gestureName = results.gestures[0][0].categoryName;
    
    if (gestureName === "Thumb_Up") {
      updateThumbProgress(deltaTime);
      
      if (isThumbProgressComplete()) {
        hideIntroUI();
        showGameUI();
        playStartSound(); // Play start sound when the game begins
        startGame();
        resetGame(gameConfig, dimensions.canvasWidth);
      }
    } else {
      // Reset progress if a different gesture is detected
      resetThumbProgress();
    }
  } else {
    // Reset progress if no hand is detected (tracking lost)
    resetThumbProgress();
  }
}

function showIntroUI() {
  endGameText.classList.add('hidden');
  introElements.forEach(element => {
    element.classList.remove('hidden');
  });
}

function hideIntroUI() {
  introElements.forEach(element => {
    element.classList.add('hidden');
  });
  
}

function showGameUI() {
  currentPlayerTextElement.classList.remove('hidden');
  gameElements.forEach(element => {
    element.classList.remove('hidden');
  });
}

function hideGameUI() {
  gameElements.forEach(element => {
    element.classList.add('hidden');
  });
}

/**
 * Handle game state
 */
function handleGameState(results: any, deltaTime: number) {
  if (canvasCtx!) {
    canvasCtx!.clearRect(0, 0, canvasElement.width, canvasElement.height);
  }

  // Update explosions
  updateExplosions(deltaTime);

  // Draw the game board
  if (canvasCtx!) {
    drawGameBoard(
      canvasCtx!, 
      gameBoard, 
      gameConfig, 
      dimensions.canvasWidth, 
      dimensions.canvasHeight
    );
  }
  
  // Process bomb animation if needed
  if (bombDropped) {
    bombTimer += deltaTime;
    
    // After a short delay, apply gravity and resume game
    if (bombTimer > 1000 && !gravityApplied) {
      applyGravityAfterBombing(
        gameBoard,
        gameConfig,
        discRotations,
        discTypes,
        getBoardStartX(dimensions.canvasWidth, gameConfig.cellSize, gameConfig.cols),
        getBoardStartY(dimensions.canvasHeight, gameConfig.cellSize, gameConfig.rows)
      );
      gravityApplied = true;
    }
    
    // After explosion finishes, reset bomb animation states
    if (bombTimer > 2000) {
      bombDropped = false;
      bombTimer = 0;
      gravityApplied = false;
    }
  }
  
  // Update and draw animating discs
  updateAnimatingDiscs();
  
  // Process hand gestures only if game is not over and no bomb animation
  if (!gameOver && !bombDropped) {
    processHandGestures(
      results,
      activeDisc,
      gameConfig,
      dimensions.canvasWidth,
      dimensions.canvasHeight,
      handleDiscGrab,
      handleDiscRelease,
      handleDiscMove,
      handlePeaceSign,
      canvasCtx!!,
      currentPlayer // Pass the current player to the function
    );
  }

  // Draw the preview and active discs (only if game is not over and no bomb animation)
  if (!gameOver && !bombDropped) {
    drawPreviewDisc(canvasCtx!, previewDisc);
    drawActiveDisc(canvasCtx!, activeDisc);
  }

  // Handle game over timer
  if (gameOver) {
    const winTime = updateWinTimer(deltaTime);
    const timeLeft = Math.max(0, Math.ceil((winTimerDuration - winTime) / 1000));
    
    // Display game status with timer
    drawGameStatus(
      canvasCtx!, 
      gameOver, 
      currentPlayer, 
      timeLeft
    );
    
    // Check if timer expired
    if (winTime >= winTimerDuration) {
      showIntroUI();
      hideGameUI();
      // Reset to landing page
      setAppState("landing");
      resetGame(gameConfig, dimensions.canvasWidth);
    }
  } else {
    // Display normal game status
    drawGameStatus(
      canvasCtx!, 
      gameOver, 
      currentPlayer, 
    );
  }
  
  
  // Remove the click to reset logic - we now use a timer
  canvasElement.onclick = null;
}

/**
 * Handle peace sign gesture for toggling bomb
 */
function handlePeaceSign() {
  if (!gameOver && !bombDropped && !activeDisc.isGrabbed) {
    const toggled = toggleBomb();
    if (toggled) {
      playGrabSound(); // Play sound when toggling bomb
    }
  }
}

/**
 * Update and draw animating discs
 */
function updateAnimatingDiscs() {
  for (let i = animatingDiscs.length - 1; i >= 0; i--) {
    const disc = animatingDiscs[i];
    
    // Update disc position
    const animationComplete = updateAnimatingDisc(disc);
    
    if (animationComplete) {
      // Place the disc in its final position
      disc.x = disc.targetX;
      disc.y = disc.targetY;
      
      // Store the final rotation and disc type
      discRotations[disc.row][disc.col] = disc.rotation;
      discTypes[disc.row][disc.col] = disc.type;
      
      // Update the game board
      gameBoard[disc.row][disc.col] = disc.player;
      
      // Check if this was a bomb
      if (disc.type === "bomb") {
        handleBombLanding(disc);
      } else {
        // Check for a win using the player who just made the move
        const positions = checkWin(gameBoard, disc.row, disc.col, disc.player);
        if (positions) {
          setWinningPositions(positions);
          setGameOver(true);
          playWinSound(); // Play win sound when a player wins
        }
      }
      
      // Remove this disc from the animating array
      removeAnimatingDisc(i);
    }
    
    // Draw the animating disc
    drawAnimatingDisc(canvasCtx!, disc);
  }
}

/**
 * Handle bomb landing and explosion
 */
function handleBombLanding(disc: any) {
  // Set bomb animation flag
  bombDropped = true;
  bombTimer = 0;
  gravityApplied = false;
  
  // Play explosion sound
  playExplosionSound();
  
  // Process bomb explosion
  const affectedPositions = processBombExplosion(gameBoard, disc.row, disc.col);
  
  // Clear rotation and type data for affected positions
  affectedPositions.forEach(pos => {
    discRotations[pos.row][pos.col] = null;
    discTypes[pos.row][pos.col] = null;
  });
  
  // Add explosion effect at bomb position
  const boardStartX = getBoardStartX(dimensions.canvasWidth, gameConfig.cellSize, gameConfig.cols);
  const boardStartY = getBoardStartY(dimensions.canvasHeight, gameConfig.cellSize, gameConfig.rows);
  
  const explosionX = boardStartX + disc.col * gameConfig.cellSize + gameConfig.cellSize / 2;
  const explosionY = boardStartY + disc.row * gameConfig.cellSize + gameConfig.cellSize / 2;
  
  addExplosion(explosionX, explosionY, disc.player);
}

/**
 * Handle when a disc is grabbed
 */
function handleDiscGrab(x: number, y: number) {
  if (!activeDisc.isGrabbed) {
    const dx = x - activeDisc.x;
    const dy = y - activeDisc.y;
    if (Math.sqrt(dx * dx + dy * dy) < activeDisc.radius * 5) {
      activeDisc.isGrabbed = true;
      playGrabSound(); // Play grab sound when a disc is grabbed
    }
  }
}

/**
 * Handle when a disc is released
 */
function handleDiscRelease(col: number) {
  if (activeDisc.isGrabbed && !gameOver) {
    if (col >= 0 && col < gameConfig.cols) {
      const newDisc = dropDisc(
        col, 
        gameBoard, 
        gameConfig, 
        dimensions, 
        activeDisc, 
        currentPlayer
      );
      
      if (newDisc) {
        // If dropping a bomb, use it
        if (activeDisc.type === "bomb") {
          useBomb();
        }
        
        addAnimatingDisc(newDisc);
        playPlaceSound(); // Play sound when disc is placed
        switchPlayer(dimensions.canvasWidth);
      }
    }
  }
  activeDisc.isGrabbed = false;
  resetPreviewDisc(previewDisc); // Hide preview when not grabbing
}

/**
 * Handle disc movement
 */
function handleDiscMove(x: number, y: number, col: number) {
  activeDisc.x = x;
  activeDisc.y = Math.min(gameConfig.cellSize, y);
  
  updatePreviewDisc(
    previewDisc,
    activeDisc,
    gameBoard,
    col,
    gameConfig,
    dimensions.canvasWidth,
    dimensions.canvasHeight
  );
}