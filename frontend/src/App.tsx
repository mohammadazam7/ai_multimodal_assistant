import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box, OrbitControls, Text, Sphere } from '@react-three/drei';
import axios from 'axios';
import './App.css';

// Enhanced interface for AI responses with new fields
interface AIResponse {
  message?: string;
  response?: string;
  status?: string;
  pytorch?: string;
  opencv?: string;
  transformers?: string;
  objects?: string[];
  yolo_available?: boolean;
  detection_classes?: number;
  detection_method?: string;
  object_count?: number;
}

// Enhanced rotating cube with more complex animation
function RotatingCube() {
  const meshRef = useRef<any>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      // More complex rotation patterns
      meshRef.current.rotation.x += delta;
      meshRef.current.rotation.y += delta * 0.5;
      meshRef.current.rotation.z += delta * 0.25;
      
      // Subtle floating animation
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });
  
  return (
    <Box ref={meshRef} args={[1, 1, 1]} position={[0, 0, 0]}>
      <meshStandardMaterial 
        color="hotpink" 
        metalness={0.3} 
        roughness={0.4}
      />
    </Box>
  );
}

// New component for displaying detected objects as 3D spheres
function DetectedObjectSphere({ object, position, index }: { 
  object: string, 
  position: [number, number, number], 
  index: number 
}) {
  const meshRef = useRef<any>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Individual rotation for each object sphere
      meshRef.current.rotation.y += delta * (0.5 + index * 0.1);
      
      // Pulsing effect based on object confidence
      const scale = 1 + Math.sin(state.clock.elapsedTime + index) * 0.1;
      meshRef.current.scale.setScalar(scale);
    }
  });
  
  return (
    <group position={position}>
      <Sphere ref={meshRef} args={[0.2]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color={`hsl(${index * 40}, 70%, 60%)`} 
          emissive={`hsl(${index * 40}, 70%, 20%)`}
        />
      </Sphere>
      <Text
        position={[0, -0.5, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {object}
      </Text>
    </group>
  );
}

// Main Application Component
function App() {
  // Enhanced state management
  const [aiResponse, setAiResponse] = useState<string>('AI Assistant Ready');
  const [connectionStatus, setConnectionStatus] = useState<string>('Checking...');
  const [aiStatus, setAiStatus] = useState<AIResponse | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [autoAnalysis, setAutoAnalysis] = useState<boolean>(false);
  const [objectCount, setObjectCount] = useState<number>(0);
  const [detectionMethod, setDetectionMethod] = useState<string>('Unknown');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [analysisHistory, setAnalysisHistory] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize app
  useEffect(() => {
    checkConnection();
    getAIStatus();
    getCapabilities();
  }, []);

  // Auto-analysis effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoAnalysis && cameraActive) {
      interval = setInterval(() => {
        analyzeFrame();
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoAnalysis, cameraActive]);

  // Enhanced API communication functions
  const checkConnection = async () => {
    try {
      const response = await axios.get('http://localhost:8000/');
      setConnectionStatus(`Connected - ${response.data.detection_mode}`);
    } catch (error) {
      setConnectionStatus('Backend Disconnected');
    }
  };

  const getAIStatus = async () => {
    try {
      const response = await axios.get('http://localhost:8000/ai/status');
      setAiStatus(response.data);
      setDetectionMethod(response.data.yolo_available ? 'YOLO v8' : 'Edge Detection');
    } catch (error) {
      console.error('Failed to get AI status');
    }
  };

  // New function to get AI capabilities
  const getCapabilities = async () => {
    try {
      const response = await axios.get('http://localhost:8000/ai/capabilities');
      setCapabilities(response.data.examples || []);
    } catch (error) {
      console.error('Failed to get capabilities');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setAiResponse('Camera activated - Ready for analysis');
      }
    } catch (error) {
      setAiResponse('Camera access denied');
    }
  };

  // Enhanced frame analysis with more detailed results
  const analyzeFrame = async () => {
    if (!videoRef.current || !cameraActive) return;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0, 640, 480);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    try {