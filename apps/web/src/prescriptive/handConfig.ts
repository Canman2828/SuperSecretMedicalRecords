// Shared by the hand-tracking worker and its main-thread fallback.
export const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
export const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const HAND_OPTIONS = {
  runningMode: 'VIDEO' as const,
  numHands: 2,
  minHandDetectionConfidence: 0.6,
  minHandPresenceConfidence: 0.6,
  minTrackingConfidence: 0.5,
};

/** Width of the downscaled frame sent to the tracker. The model works at ~224 px, so more is wasted work. */
export const DETECT_WIDTH = 320;
