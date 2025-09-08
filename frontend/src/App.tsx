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
      const response = await axios.post('http://localhost:8000/ai/analyze-frame', {
        image: imageData
      });
      
      // Enhanced state updates
      setDetectedObjects(response.data.objects || []);
      setObjectCount(response.data.object_count || 0);
      setDetectionMethod(response.data.detection_method || 'Unknown');
      
      const resultText = response.data.objects?.join(', ') || 'Nothing';
      setAiResponse(`Detected: ${resultText}`);
      
      // Add to analysis history
      setAnalysisHistory(prev => {
        const newHistory = [`${new Date().toLocaleTimeString()}: ${resultText}`, ...prev];
        return newHistory.slice(0, 5); // Keep last 5 analyses
      });
      
    } catch (error) {
      setAiResponse('Analysis failed - Check backend connection');
    }
  };

  const toggleAutoAnalysis = () => {
    setAutoAnalysis(!autoAnalysis);
    if (!autoAnalysis) {
      setAiResponse('Auto-analysis started - Monitoring every 2 seconds');
    } else {
      setAiResponse('Auto-analysis stopped - Manual mode active');
    }
  };

  const testAI = async () => {
    try {
      const response = await axios.get('http://localhost:8000/ai/test');
      setAiResponse(response.data.response);
    } catch (error) {
      setAiResponse('Failed to connect to AI backend');
    }
  };

  // New function to test specific object detection
  const showCapabilities = () => {
    if (capabilities.length > 0) {
      setAiResponse(`Can detect: ${capabilities.slice(0, 10).join(', ')}... and ${capabilities.length - 10} more`);
    }
  };

  // Calculate 3D positions for detected objects in a circle
  const getObjectPosition = (index: number, total: number): [number, number, number] => {
    const radius = 4;
    const angle = (index / total) * Math.PI * 2;
    return [
      Math.cos(angle) * radius,
      Math.sin(index * 0.5) * 0.5,
      Math.sin(angle) * radius
    ];
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      {/* Enhanced camera feed with status indicator */}
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
          border: `3px solid ${cameraActive ? '#00ff00' : 'hotpink'}`,
          borderRadius: '10px',
          display: cameraActive ? 'block' : 'none',
          boxShadow: '0 0 20px rgba(255, 20, 147, 0.5)'
        }}
      />

      {/* Enhanced control panel */}
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        color: 'white', 
        zIndex: 1000,
        fontFamily: 'Arial',
        background: 'rgba(0,0,0,0.9)',
        padding: '20px',
        borderRadius: '15px',
        minWidth: '350px',
        border: '1px solid #333',
        boxShadow: '0 0 30px rgba(0, 0, 0, 0.8)'
      }}>
        <h1 style={{ margin: '0 0 15px 0', color: '#00ffff' }}>
          AI Assistant Control Center
        </h1>
        
        {/* Status indicators */}
        <div style={{ marginBottom: '15px' }}>
          <p style={{ margin: '5px 0', color: connectionStatus.includes('Connected') ? '#00ff00' : '#ff0000' }}>
            🔗 Status: {connectionStatus}
          </p>
          <p style={{ margin: '5px 0' }}>🧠 Mode: {detectionMethod}</p>
          <p style={{ margin: '5px 0' }}>📹 Camera: {cameraActive ? '🟢 Active' : '🔴 Inactive'}</p>
          <p style={{ margin: '5px 0' }}>🤖 Auto: {autoAnalysis ? '🟠 Running' : '🟣 Stopped'}</p>
          <p style={{ margin: '5px 0' }}>📊 Objects: {objectCount}</p>
        </div>
        
        {/* AI Response */}
        <div style={{ 
          background: 'rgba(0, 255, 255, 0.1)', 
          padding: '10px', 
          borderRadius: '8px', 
          marginBottom: '15px',
          border: '1px solid #00ffff'
        }}>
          <p style={{ margin: '0', color: '#00ffff', fontSize: '14px' }}>
            💬 {aiResponse}
          </p>
        </div>
        
        {/* Enhanced AI system info */}
        {aiStatus && (
          <div style={{ marginBottom: '15px', fontSize: '12px', color: '#aaa' }}>
            <p>⚡ PyTorch: {aiStatus.pytorch}</p>
            <p>👁️ OpenCV: {aiStatus.opencv}</p>
            <p>🧠 YOLO: {aiStatus.yolo_available ? 'Available' : 'Not Available'}</p>
            {aiStatus.detection_classes && (
              <p>🎯 Classes: {aiStatus.detection_classes}</p>
            )}
          </div>
        )}
        
        {/* Enhanced button controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          <button onClick={testAI} style={buttonStyle('#ff1493')}>
            🧪 Test AI
          </button>
          
          <button onClick={startCamera} style={buttonStyle('#00ff00')}>
            📹 Start Camera
          </button>
          
          <button 
            onClick={analyzeFrame}
            disabled={!cameraActive}
            style={buttonStyle(cameraActive ? '#0080ff' : '#666')}
          >
            🔍 Analyze Frame
          </button>

          <button 
            onClick={toggleAutoAnalysis}
            disabled={!cameraActive}
            style={buttonStyle(autoAnalysis ? '#ff8000' : '#8000ff')}
          >
            {autoAnalysis ? '⏹️ Stop Auto' : '▶️ Start Auto'}
          </button>
          
          <button onClick={showCapabilities} style={buttonStyle('#ff6600')}>
            📋 Show Capabilities
          </button>
          
          <button onClick={getCapabilities} style={buttonStyle('#00ff80')}>
            🔄 Refresh
          </button>
        </div>