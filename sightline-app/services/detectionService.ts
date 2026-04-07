/**
 * Detection Service
 * Handles object detection from camera frames using FastAPI backend
 */

import { CameraFrame } from "./cameraService";
import { getDetectionEndpoint } from "./config";

// API Configuration
const DETECTION_ENDPOINT = getDetectionEndpoint();
console.log("[SightViz Detection] Detection endpoint initialized:", DETECTION_ENDPOINT);

export interface DetectionResult {
  objects: DetectedObject[];
  frameTimestamp: number;
  processingTime: number;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  distance?: string; // e.g., "3 feet", "5 meters"
  position?: "ahead" | "left" | "right" | "behind";
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// API Response types
interface APIDetectionResponse {
  frame_id: string;
  timestamp_ms: number;
  image_size: {
    width: number;
    height: number;
  };
  detections: {
    id: string;
    label: string;
    confidence: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];
}

// New Spatial Engine API Response
interface AnalyzeResponse {
  speech: string | null;
  debug?: {
    latency_ms: number;
    num_detections: number;
    raw_yolo_count: number;
    detections: {
      label: string;
      direction: string;
      distance: string;
      confidence: number;
    }[];
  };
}

/**
 * Calculate position based on bounding box location in frame
 */
const calculatePosition = (
  bbox: { x: number; y: number; width: number; height: number },
  imageWidth: number
): "ahead" | "left" | "right" => {
  const centerX = bbox.x + bbox.width / 2;
  const leftThird = imageWidth / 3;
  const rightThird = (imageWidth * 2) / 3;

  if (centerX < leftThird) {
    return "left";
  } else if (centerX > rightThird) {
    return "right";
  } else {
    return "ahead";
  }
};

/**
 * Estimate distance based on bounding box size
 * Larger objects are closer, smaller objects are farther
 */
const estimateDistance = (
  bbox: { x: number; y: number; width: number; height: number },
  imageHeight: number
): string => {
  const objectHeight = bbox.height;
  const heightRatio = objectHeight / imageHeight;

  // Simple heuristic: larger objects are closer
  if (heightRatio > 0.6) {
    return "2 feet";
  } else if (heightRatio > 0.4) {
    return "4 feet";
  } else if (heightRatio > 0.25) {
    return "6 feet";
  } else if (heightRatio > 0.15) {
    return "8 feet";
  } else {
    return "10 feet";
  }
};

/**
 * Process a camera frame and detect objects using FastAPI backend
 * @param frame - The camera frame to process
 * @returns Detection results
 */
export const detectObjectsInFrame = async (
  frame: CameraFrame
): Promise<DetectionResult> => {
  const startTime = Date.now();

  try {
    console.log("=== SENDING API REQUEST ===");
    console.log("Endpoint:", DETECTION_ENDPOINT);
    console.log("Frame URI:", frame.uri);
    console.log("Timestamp:", new Date().toISOString());
    
    // Create FormData for file upload
    const formData = new FormData();
    
    // React Native FormData expects a specific format
    // @ts-ignore - React Native FormData accepts this format
    formData.append("file", {
      uri: frame.uri,
      type: "image/png",
      name: `frame_${frame.timestamp}.jpg`,
    });

    console.log("FormData created, sending POST request...");
    console.log("Request URL:", DETECTION_ENDPOINT);
    console.log("Request method: POST");
    
    // Send to FastAPI server
    const apiResponse = await fetch(DETECTION_ENDPOINT, {
      method: "POST",
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log("API Response received!");
    console.log("API Response status:", apiResponse.status);
    console.log("API Response headers:", JSON.stringify(apiResponse.headers));
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("API Error Response:", errorText);
      
      // Specific handling for 413 Payload Too Large
      if (apiResponse.status === 413) {
        throw new Error(`Server payload limit exceeded (413). Image already resized to 1024px.`);
      }
      
      throw new Error(`API request failed: ${apiResponse.status} - ${errorText}`);
    }

    const data: APIDetectionResponse = await apiResponse.json();
    
    console.log("API Response:", JSON.stringify(data, null, 2));
    console.log(`API returned ${data.detections.length} detections`);

    // Convert API response to our format
    const objects: DetectedObject[] = data.detections.map((detection) => {
      const position = calculatePosition(detection.bbox, data.image_size.width);
      const distance = estimateDistance(detection.bbox, data.image_size.height);

      return {
        label: detection.label,
        confidence: detection.confidence,
        position,
        distance,
        bbox: detection.bbox,
      };
    });

    const processingTime = Date.now() - startTime;
    
    console.log(`Converted to ${objects.length} objects:`, objects);

    return {
      objects,
      frameTimestamp: frame.timestamp,
      processingTime,
    };
  } catch (error) {
    console.error("=== ERROR DETECTING OBJECTS ===");
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error("Endpoint was:", DETECTION_ENDPOINT);
    console.error("===============================");
    
    // Check for specific error types
    if (error instanceof TypeError && error.message.includes("Network")) {
      console.error("NETWORK ERROR: Cannot reach server. Check:");
      console.error("1. Server is running at", DETECTION_ENDPOINT);
      console.error("2. Device has internet connection");
      console.error("3. Firewall/security settings allow connection");
    }
    
    // Fallback to demo mode if API fails
    console.warn("API detection failed, using demo mode");
    return detectObjectsDemo(frame);
  }
};

/**
 * NEW: Analyze frame with Spatial Engine (returns speech guidance)
 * @param frame - The camera frame to process
 * @returns Speech output (null = silence, string = speak this)
 */
export const analyzeFrameWithSpatialEngine = async (
  frame: CameraFrame
): Promise<string | null> => {
  try {
    console.log("=== ANALYZING FRAME WITH SPATIAL ENGINE ===");
    
    // Get analyze endpoint (replace /detect with /analyze)
    const analyzeEndpoint = DETECTION_ENDPOINT.replace('/detect', '/analyze');
    console.log("Endpoint:", analyzeEndpoint);
    console.log("Frame URI:", frame.uri);
    console.log("Timestamp:", new Date().toISOString());
    
    // Create FormData for file upload
    const formData = new FormData();
    
    // React Native FormData expects a specific format
    // @ts-ignore - React Native FormData accepts this format
    formData.append("file", {
      uri: frame.uri,
      type: "image/png",
      name: `frame_${frame.timestamp}.jpg`,
    });

    console.log("FormData created, sending to Spatial Engine...");
    console.log("Request URL:", analyzeEndpoint);
    
    // Send to FastAPI /analyze endpoint
    const apiResponse = await fetch(analyzeEndpoint, {
      method: "POST",
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("API Error Response:", errorText);
      
      // Specific handling for 413 Payload Too Large
      if (apiResponse.status === 413) {
        throw new Error(`Image too large (413). Server cannot process this size.`);
      }
      
      throw new Error(`API request failed: ${apiResponse.status}`);
    }

    const data: AnalyzeResponse = await apiResponse.json();
    
    console.log("Spatial Engine Response:", JSON.stringify(data, null, 2));
    
    if (data.debug) {
      console.log(`Latency: ${data.debug.latency_ms}ms`);
      console.log(`Detections: ${data.debug.num_detections}`);
    }
    
    if (data.speech) {
      console.log(`[SPEECH] "${data.speech}"`);
    } else {
      console.log("[SILENT] No speech output");
    }

    return data.speech;
    
  } catch (error) {
    console.error("=== ERROR ANALYZING WITH SPATIAL ENGINE ===");
    console.error("Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error("Endpoint was:", DETECTION_ENDPOINT.replace('/detect', '/analyze'));
    console.error("==========================================");
    
    // Check for specific error types
    if (error instanceof TypeError && error.message.includes("Network")) {
      console.error("NETWORK ERROR: Cannot reach Spatial Engine server");
      throw new Error(`Network Error: Cannot reach ${DETECTION_ENDPOINT.replace('/detect', '/analyze')}`);
    }
    
    // Re-throw the error so UI can display it
    throw error;
  }
};

/**
 * Demo detection fallback (used when API is unavailable)
 */
const detectObjectsDemo = async (
  frame: CameraFrame
): Promise<DetectionResult> => {
  const startTime = Date.now();
  
  // Simulate detection with random objects
  const demoObjects = await simulateDetection();

  const processingTime = Date.now() - startTime;

  return {
    objects: demoObjects,
    frameTimestamp: frame.timestamp,
    processingTime,
  };
};

/**
 * Simulate object detection (demo mode)
 * This will be replaced with actual ML model
 */
const simulateDetection = async (): Promise<DetectedObject[]> => {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  const possibleObjects = [
    { label: "Chair", distance: "3 feet", position: "ahead" as const },
    { label: "Table", distance: "5 feet", position: "right" as const },
    { label: "Door", distance: "8 feet", position: "ahead" as const },
    { label: "Person", distance: "4 feet", position: "left" as const },
    { label: "Wall", distance: "4 feet", position: "ahead" as const },
    { label: "Stairs", distance: "6 feet", position: "ahead" as const },
    { label: "Window", distance: "7 feet", position: "left" as const },
    { label: "Cup", distance: "2 feet", position: "right" as const },
  ];

  // Randomly select 1-3 objects
  const numObjects = Math.floor(Math.random() * 3) + 1;
  const detected: DetectedObject[] = [];

  for (let i = 0; i < numObjects; i++) {
    const obj = possibleObjects[Math.floor(Math.random() * possibleObjects.length)];
    detected.push({
      ...obj,
      confidence: 0.7 + Math.random() * 0.3, // Random confidence 70-100%
    });
  }

  return detected;
};

/**
 * Convert detection results to human-readable announcement
 * @param result - Detection results
 * @returns String to be spoken via text-to-speech
 */
export const formatDetectionForSpeech = (result: DetectionResult): string => {
  if (result.objects.length === 0) {
    return "Clear path ahead";
  }

  // Sort by confidence to prioritize most important detections
  const sortedObjects = [...result.objects].sort(
    (a, b) => b.confidence - a.confidence
  );

  // Take top 3 most confident detections
  const topObjects = sortedObjects.slice(0, 3);

  if (topObjects.length === 1) {
    const obj = topObjects[0];
    return `${obj.label} ${obj.position || ""} ${obj.distance || ""}`.trim();
  }

  // Multiple objects - announce most important ones
  const descriptions = topObjects.map((obj) => {
    // For closer objects, be more specific
    const distanceNum = parseInt(obj.distance || "10");
    if (distanceNum <= 4) {
      return `${obj.label} ${obj.position || ""} ${obj.distance || ""}`.trim();
    } else {
      // For farther objects, just mention label and position
      return `${obj.label} ${obj.position || ""}`.trim();
    }
  });

  return descriptions.join(", ");
};

/**
 * Send frame to remote API for detection
 * @param frame - Camera frame
 * @returns Detection results from API
 */
export const detectViaAPI = async (
  frame: CameraFrame
): Promise<DetectionResult> => {
  // This now uses the main detectObjectsInFrame function
  // which already calls the API
  return detectObjectsInFrame(frame);
};
