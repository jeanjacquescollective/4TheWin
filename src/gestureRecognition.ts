import {
  GestureRecognizer,
  FilesetResolver,
  DrawingUtils
} from "@mediapipe/tasks-vision";

import {  GameConfig, Player } from './types';
import { getBoardStartX } from './gameLogic';

let gestureRecognizer: GestureRecognizer;
let runningMode: "IMAGE" | "VIDEO" = "IMAGE";
let lastVideoTime = -1;
let lastTimestamp = 0;
let lastResults: { timestamp: number; } | undefined = undefined; // Store last valid results
let lastPeaceSignTime = 0; // Timestamp of last peace sign to prevent repeated toggling
let lastGesture = ""; // Store last gesture to prevent repeated peace sign toggling
/**
 * Initialize the gesture recognizer
 */
export async function initializeGestureRecognizer(demosSectionId: string): Promise<void> {
  const demosSection = document.getElementById(demosSectionId);
  if (!demosSection) {
    console.error(`Element with ID "${demosSectionId}" not found`);
    throw new Error(`Element with ID "${demosSectionId}" not found`);
  }
  
  console.log("Loading vision models...");
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    
    console.log("Creating gesture recognizer...");
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "GPU"
      },
      runningMode: runningMode
    });
    
    // We don't need to remove the "invisible" class anymore
    // since we've made the section visible by default
    
    console.log("Gesture recognizer initialized successfully");
    return Promise.resolve();
  } catch (error) {
    console.error("Error initializing gesture recognizer:", error);
    throw error;
  }
}

/**
 * Process video frame for gesture recognition
 */
export async function processVideoFrame(video: HTMLVideoElement, timestamp: number) {
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
  }

  // Only process frame if video time has changed
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      const results = await gestureRecognizer.recognizeForVideo(video, timestamp) as any;
      if (results && results.landmarks && results.landmarks.length > 0) {
        // Add timestamp to results so we can check freshness
        results.timestamp = Date.now();
        // Only update lastResults if we got valid hand landmarks
        lastResults = results;
        return results;
      }
    } catch (error) {
      console.error("Error recognizing gestures:", error);
    }
  }

  // If we have lastResults and they're from within the last 200ms, return them
  if (lastResults && Date.now() - lastResults.timestamp < 200) {
    return lastResults;
  }
  
  // Otherwise return null to indicate tracking is lost
  return null;
}

/**
 * Draw hand landmarks on canvas, mirroring them to match the mirrored video
 * Using player-specific colors for the hand tracking
 */
export function drawHandLandmarks(
  canvasCtx: CanvasRenderingContext2D, 
  landmarks: any[],
  currentPlayer: Player // Add currentPlayer parameter
) {
  if (!landmarks) return;
  
  const drawingUtils = new DrawingUtils(canvasCtx);
  
  // Set colors based on current player
  let landmarkColor: string;
  let connectorColor: string;
  
  if (currentPlayer === 1) { // Player Orange
    landmarkColor = "#EF7D00"; // Orange for tracking points
    connectorColor = "#E7B481"; // Light orange for connector lines
  } else { // Player Blue
    landmarkColor = "#009AD4"; // Blue for tracking points
    connectorColor = "#A4CED7"; // Light blue for connector lines
  }
  
  // Save the current canvas state
  canvasCtx.save();
  
  // Mirror the canvas context horizontally to match the video
  canvasCtx.scale(-1, 1);
  canvasCtx.translate(-canvasCtx.canvas.width, 0);
  
  // Draw the landmarks with the mirrored context
  drawingUtils.drawConnectors(
    landmarks,
    GestureRecognizer.HAND_CONNECTIONS,
    { color: connectorColor, lineWidth: 5 }
  );
  
  drawingUtils.drawLandmarks(landmarks, { color: landmarkColor, lineWidth: 2 });
  
  // Restore the canvas state
  canvasCtx.restore();
}

/**
 * Setup webcam access
 */
export function setupWebcam(
  video: HTMLVideoElement, 
  onLoadedData: () => void
): Promise<void> {
  if (!gestureRecognizer) {
    return Promise.reject("Gesture recognizer not initialized");
  }

  return navigator.mediaDevices.getUserMedia({ 
    video: { 
      width: { ideal: window.innerWidth },
      height: { ideal: window.innerHeight }
    } 
  }).then(function (stream) {
    video.srcObject = stream;
    video.addEventListener("loadeddata", onLoadedData);
    return Promise.resolve();
  }).catch(function(err) {
    return Promise.reject(err);
  });
}

/**
 * Update timestamp for animation
 */
export function updateTimestamp(): number {
  const nowInMs = Date.now();
  const deltaTime = lastTimestamp ? nowInMs - lastTimestamp : 0;
  lastTimestamp = nowInMs;
  return deltaTime;
}

/**
 * Calculate palm center from hand landmarks
 */
export function calculatePalmCenter(landmarks: any, canvasWidth: number, canvasHeight: number) {
  // Using the wrist (landmark 0) and middle finger base (landmark 9) for palm center
  const wrist = landmarks[0];
  const middleBase = landmarks[9];
  
  // Calculate the original x-coordinate (based on unmirrored landmarks)
  const originalX = (wrist.x + middleBase.x) / 2 * canvasWidth;
  // Flip the x-coordinate to match the mirrored display
  const mirroredX = canvasWidth - originalX;
  
  return {
    x: mirroredX,
    y: (wrist.y + middleBase.y) / 2 * canvasHeight
  };
}

/**
 * Process hand gestures for game interaction
 */
export function processHandGestures(
  results: any,
  activeDisc: any,
  gameConfig: GameConfig,
  canvasWidth: number,
  canvasHeight: number,
  onGrab: (x: number, y: number) => void,
  onRelease: (col: number) => void,
  onMove: (x: number, y: number, col: number) => void,
  onPeaceSign: () => void, // Add peace sign handler
  canvasCtx: CanvasRenderingContext2D,
  currentPlayer: Player // Add currentPlayer parameter
) {
  // Only process if we have valid, current results with landmarks
  if (!results || !results.landmarks || !results.landmarks.length) {
    // Reset active disc grab state when tracking is lost
    if (activeDisc.isGrabbed) {
      activeDisc.isGrabbed = false;
      // If there's an onRelease callback, call it with an invalid column to ensure proper cleanup
      onRelease(-1);
    }
    return;
  }
  
  // Use timestamp to check if the results are current
  const currentTimestamp = Date.now();
  const resultAge = currentTimestamp - results.timestamp;
  
  // If results are older than 500ms, consider tracking lost
  if (results.timestamp && resultAge > 500) {
    if (activeDisc.isGrabbed) {
      activeDisc.isGrabbed = false;
      onRelease(-1);
    }
    return;
  }
  
  // Draw hand landmarks for all detected hands
  for (const landmarks of results.landmarks) {
    // Draw hand landmarks with current player colors
    drawHandLandmarks(canvasCtx, landmarks, currentPlayer);

    // Get the palm center position
    const palmCenter = calculatePalmCenter(landmarks, canvasWidth, canvasHeight);
    const handX = palmCenter.x;
    const handY = palmCenter.y;

    // Handle hand interaction only if we have gesture data
    if (results.gestures && results.gestures.length > 0) {
      // Detect grab or release gesture
      const gestureName = results.gestures[0][0].categoryName;
      
      if (gestureName === "Closed_Fist") {
        onGrab(handX, handY);
      } else if (gestureName === "Open_Palm") {
        const col = calculateCurrentColumn(handX, gameConfig, canvasWidth);
        onRelease(col);
      } else if (gestureName === "Victory" || gestureName === "Peace") {
        // Handle peace sign for bomb toggle, with debounce to prevent multiple toggles
        const now = Date.now();
        if (now - lastPeaceSignTime > 1000 && lastGesture !== "Victory" && lastGesture !== "Peace") { // 1 second debounce and require different gesture
          onPeaceSign();
          lastPeaceSignTime = now;
        }
      }
      // Update lastGesture to the current gesture
      lastGesture = gestureName;
    }

    if (activeDisc.isGrabbed) {
      const col = calculateCurrentColumn(handX, gameConfig, canvasWidth);
      onMove(handX, handY, col);
    }
  }
}

/**
 * Calculate current column from hand X position
 */
function calculateCurrentColumn(handX: number, gameConfig: GameConfig, canvasWidth: number): number {
  const boardStartX = getBoardStartX(canvasWidth, gameConfig.cellSize, gameConfig.cols);
  return Math.floor((handX - boardStartX) / gameConfig.cellSize);
}