// Audio elements for game sounds
let placeSound: HTMLAudioElement | null = null;
let winSound: HTMLAudioElement | null = null;
let startSound: HTMLAudioElement | null = null;
let grabSound: HTMLAudioElement | null = null;
let explosionSound: HTMLAudioElement | null = null;

/**
 * Initialize audio elements
 */
export function initializeAudio(): void {
  // Create and configure Place Sound
  placeSound = new Audio('sounds/place.mp3');
  placeSound.volume = 0.5;
  
  // Create and configure Win Sound
  winSound = new Audio('sounds/win.mp3');
  winSound.volume = 0.7;
  
  // Create and configure Start Sound
  startSound = new Audio('sounds/start.mp3');
  startSound.volume = 0.6;
  
  // Create and configure Grab Sound
  grabSound = new Audio('sounds/grab.mp3');
  grabSound.volume = 0.4;
  
  // Create and configure Explosion Sound
  explosionSound = new Audio('sounds/bomb.mp3');
  explosionSound.volume = 0.7;
}

/**
 * Play disc placement sound
 */
export function playPlaceSound(): void {
  if (placeSound) {
    placeSound.currentTime = 0;
    placeSound.play().catch(error => {
      console.error("Error playing place sound:", error);
    });
  }
}

/**
 * Play win celebration sound
 */
export function playWinSound(): void {
  if (winSound) {
    winSound.currentTime = 0;
    winSound.play().catch(error => {
      console.error("Error playing win sound:", error);
    });
  }
}

/**
 * Play game start sound
 */
export function playStartSound(): void {
  if (startSound) {
    startSound.currentTime = 0;
    startSound.play().catch(error => {
      console.error("Error playing start sound:", error);
    });
  }
}

/**
 * Play disc grab sound
 */
export function playGrabSound(): void {
  if (grabSound) {
    grabSound.currentTime = 0;
    grabSound.play().catch(error => {
      console.error("Error playing grab sound:", error);
    });
  }
}

/**
 * Play bomb explosion sound
 */
export function playExplosionSound(): void {
  if (explosionSound) {
    explosionSound.currentTime = 0;
    explosionSound.play().catch(error => {
      console.error("Error playing explosion sound:", error);
    });
  }
}