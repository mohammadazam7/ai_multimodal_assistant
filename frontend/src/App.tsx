import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, OrbitControls, Text } from '@react-three/drei';
import axios from 'axios';
import './App.css';

// TypeScript interface defining the structure of AI responses
interface AIResponse {
  message?: string;
  response?: string;
  status?: string;
  pytorch?: string;
  opencv?: string;
  transformers?: string;
  objects?: string[];
}

// 3D Cube Component - displays a rotating pink cube in the scene
function RotatingCube() {
  // useRef creates a reference to the 3D mesh object
  const meshRef = useRef<any>(null);
  
  // useFrame runs every animation frame (60 FPS)
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Rotate the cube on X and Y axes
      meshRef.current.rotation.x += delta;        // Full speed X rotation
      meshRef.current.rotation.y += delta * 0.5;  // Half speed Y rotation
      meshRef.current.rotation.z += delta * 0.25; // Quarter speed Z rotation
    }
  });
  
  return (
    <Box ref={meshRef} args={[1, 1, 1]} position={[0, 0, 0]}>
      <meshStandardMaterial color="hotpink" />
    </Box>
  );
}

// Main Application Component
function App() {
  // STATE MANAGEMENT - React hooks for managing application state
  
  // useState for storing AI response messages
  const [aiResponse, setAiResponse] = useState<string>('AI Assistant Ready');
  
  // Connection status with backend
  const [connectionStatus, setConnectionStatus] = useState<string>('Checking...');
  
  // AI system information (versions, capabilities)
  const [aiStatus, setAiStatus] = useState<AIResponse | null>(null);
  
  // Camera state - whether webcam is active
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  
  // Array of detected objects from computer vision
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  
  // Auto-analysis mode - continuous vs manual detection
  const [autoAnalysis, setAutoAnalysis] = useState<boolean>(false);
  
  // useRef for direct DOM access to video element
  const videoRef = useRef<HTMLVideoElement>(null);

  // LIFECYCLE HOOKS - useEffect for side effects and lifecycle management
  
  // Effect runs once when component mounts
  useEffect(() => {
    checkConnection(); // Test backend connectivity
    getAIStatus();     // Get AI system information
  }, []);

  // Effect for automatic analysis - runs when autoAnalysis or cameraActive changes
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    // Only run auto-analysis if both flags are true
    if (autoAnalysis && cameraActive) {
      // setInterval creates repeating function calls every 2 seconds
      interval = setInterval(() => {
        analyzeFrame(); // Analyze current video frame
      }, 2000);
    }
    
    // Cleanup function - prevents memory leaks
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoAnalysis, cameraActive]); // Dependencies array

  // API COMMUNICATION FUNCTIONS
  
  // Test basic backend connectivity
  const checkConnection = async () => {
    try {
      // axios.get sends HTTP GET request
      const response = await axios.get('http://localhost:8000/');
      setConnectionStatus('Connected to AI Backend');
    } catch (error) {
      setConnectionStatus('Backend Disconnected');
    }
  };

  // Fetch AI system status and versions
  const getAIStatus = async () => {
    try {
      const response = await axios.get('http://localhost:8000/ai/status');
      setAiStatus(response.data); // Store response in state
    } catch (error) {
      console.error('Failed to get AI status');
    }
  };

  // CAMERA AND VIDEO PROCESSING FUNCTIONS
  
  // Activate user's webcam using WebRTC API
  const startCamera = async () => {
    try {
      // navigator.mediaDevices.getUserMedia accesses camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      // Connect stream to video element and then play
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setAiResponse('Camera activated');
      }
    } catch (error) {
      setAiResponse('Camera access denied');
    }
  };

  // Capture and analyze current video frame
  const analyzeFrame = async () => {
    if (!videoRef.current || !cameraActive) return;

    // HTML5 Canvas API for image processing
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    // Draw current video frame to canvas
    ctx?.drawImage(videoRef.current, 0, 0, 640, 480);
    
    // Convert canvas to base64 image data
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    try {
      // Send image to backend for analysis
      const response = await axios.post('http://localhost:8000/ai/analyze-frame', {
        image: imageData
      });
      
      // Update UI with detected objects
      setDetectedObjects(response.data.objects || []);
      setAiResponse(`Detected: ${response.data.objects?.join(', ') || 'Nothing'}`);
    } catch (error) {
      setAiResponse('Analysis failed');
    }
  };

  // Toggle automatic analysis mode
  const toggleAutoAnalysis = () => {
    setAutoAnalysis(!autoAnalysis);
    if (!autoAnalysis) {
      setAiResponse('Auto-analysis started');
    } else {
      setAiResponse('Auto-analysis stopped');
    }
  };

  // Simple AI test function
  const testAI = async () => {
    try {
      const response = await axios.get('http://localhost:8000/ai/test');
      setAiResponse(response.data.response);
    } catch (error) {
      setAiResponse('Failed to connect to AI');
    }
  };

  // RENDER FUNCTION - JSX describes the UI structure
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      {/* Camera Feed - HTML5 video element */}
      <video 
        ref={videoRef}
        autoPlay 
        playsInline
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '320px',
          height: '240px',
          border: '2px solid hotpink',
          borderRadius: '10px',
          display: cameraActive ? 'block' : 'none'
        }}
      />

      {/* UI Control Panel */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        color: 'white', 
        zIndex: 1000,
        fontFamily: 'Arial',
        background: 'rgba(0,0,0,0.8)',
        padding: '20px',
        borderRadius: '10px',
        minWidth: '300px'
      }}>
        <h1 style={{ margin: '0 0 10px 0' }}>AI Assistant Interface</h1>
        <p style={{ margin: '5px 0' }}>Status: {connectionStatus}</p>
        <p style={{ margin: '5px 0' }}>Response: {aiResponse}</p>
        <p style={{ margin: '5px 0' }}>Camera: {cameraActive ? 'Active' : 'Inactive'}</p>
        <p style={{ margin: '5px 0' }}>Auto Mode: {autoAnalysis ? 'Running' : 'Off'}</p>
        
        {/* Conditional rendering - only show if aiStatus exists */}
        {aiStatus && (
          <div style={{ marginTop: '10px', fontSize: '12px' }}>
            <p>PyTorch: {aiStatus.pytorch}</p>
            <p>OpenCV: {aiStatus.opencv}</p>
          </div>
        )}
        
        {/* Button Controls */}
        <div style={{ marginTop: '10px' }}>
          <button 
            onClick={testAI}
            style={{
              marginRight: '10px',
              marginBottom: '5px',
              padding: '10px 15px',
              background: 'hotpink',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Test AI
          </button>
          
          <button 
            onClick={startCamera}
            style={{
              marginRight: '10px',
              marginBottom: '5px',
              padding: '10px 15px',
              background: 'green',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Start Camera
          </button>
          
          <button 
            onClick={analyzeFrame}
            disabled={!cameraActive}
            style={{
              marginRight: '10px',
              marginBottom: '5px',
              padding: '10px 15px',
              background: cameraActive ? 'blue' : 'gray',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: cameraActive ? 'pointer' : 'not-allowed'
            }}
          >
            Analyze Frame
          </button>

          <button 
            onClick={toggleAutoAnalysis}
            disabled={!cameraActive}
            style={{
              marginBottom: '5px',
              padding: '10px 15px',
              background: autoAnalysis ? 'orange' : 'purple',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: cameraActive ? 'pointer' : 'not-allowed'
            }}
          >
            {autoAnalysis ? 'Stop Auto' : 'Start Auto'}
          </button>
        </div>
      </div>
      
      {/* 3D Scene using Three.js */}
      <Canvas>
        {/* Lighting setup */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        
        {/* 3D Objects */}
        <RotatingCube />
        <OrbitControls />
        
        {/* 3D Text displaying AI response */}
        <Text
          position={[0, 2, 0]}
          fontSize={0.5}
          color="cyan"
          anchorX="center"
          anchorY="middle"
        >
          {aiResponse}
        </Text>

        {/* Dynamic 3D text for each detected object */}
        {detectedObjects.map((object, index) => (
          <Text
            key={index}
            position={[Math.sin(index) * 3, 1, Math.cos(index) * 3]}
            fontSize={0.3}
            color="yellow"
            anchorX="center"
            anchorY="middle"
          >
            {object}
          </Text>
        ))}
      </Canvas>
    </div>
  );
}

export default App;