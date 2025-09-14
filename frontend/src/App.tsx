import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  Box, 
  OrbitControls, 
  Text, 
  Sphere, 
  Ring, 
  Torus,
  Cylinder,
  Plane,
  Stars,
  Environment,
  useTexture,
  Html
} from '@react-three/drei';
import * as THREE from 'three';
import axios from 'axios';
import './App.css';

// TypeScript interfaces
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

// Central AI Core with enhanced animations
function AICore() {
  const coreGroupRef = useRef<THREE.Group>(null);
  const innerCoreRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const middleRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (coreGroupRef.current) {
      coreGroupRef.current.rotation.y += delta * 0.1;
    }
    
    if (innerCoreRef.current) {
      innerCoreRef.current.rotation.x += delta * 0.8;
      innerCoreRef.current.rotation.y += delta * 0.6;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
      innerCoreRef.current.scale.setScalar(scale);
    }
    
    if (outerRingRef.current) {
      outerRingRef.current.rotation.x += delta * 0.5;
      outerRingRef.current.rotation.z += delta * 0.3;
    }
    
    if (middleRingRef.current) {
      middleRingRef.current.rotation.y += delta * 0.8;
      middleRingRef.current.rotation.z -= delta * 0.4;
    }
    
    if (innerRingRef.current) {
      innerRingRef.current.rotation.x -= delta * 0.6;
      innerRingRef.current.rotation.y += delta * 0.9;
    }
  });
  
  return (
    <group ref={coreGroupRef} position={[0, 0, 0]}>
      {/* Central glowing core */}
      <Sphere ref={innerCoreRef} args={[1.5]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#00ffff" 
          emissive="#00aaaa"
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </Sphere>
      
      {/* Inner energy sphere */}
      <Sphere args={[0.8]} position={[0, 0, 0]}>
        <meshBasicMaterial 
          color="#ffffff" 
          transparent
          opacity={0.6}
        />
      </Sphere>
      
      {/* Rotating rings */}
      <Ring ref={outerRingRef} args={[3, 3.5, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#ff0080" 
          emissive="#aa0040"
          emissiveIntensity={0.3}
          side={THREE.DoubleSide}
          transparent
          opacity={0.7}
        />
      </Ring>
      
      <Ring ref={middleRingRef} args={[4.5, 5, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#8000ff" 
          emissive="#400080"
          emissiveIntensity={0.3}
          side={THREE.DoubleSide}
          transparent
          opacity={0.6}
        />
      </Ring>
      
      <Ring ref={innerRingRef} args={[6, 6.8, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#0080ff" 
          emissive="#004080"
          emissiveIntensity={0.3}
          side={THREE.DoubleSide}
          transparent
          opacity={0.5}
        />
      </Ring>
      
      {/* Energy particles */}
      {Array.from({ length: 40 }).map((_, i) => (
        <EnergyParticle key={i} index={i} />
      ))}
    </group>
  );
}

// Enhanced floating particles
function EnergyParticle({ index }: { index: number }) {
  const particleRef = useRef<THREE.Mesh>(null);
  const radius = 7 + Math.random() * 5;
  const speed = 0.2 + Math.random() * 0.8;
  const height = (Math.random() - 0.5) * 10;
  const size = 0.05 + Math.random() * 0.1;
  
  useFrame((state) => {
    if (particleRef.current) {
      const time = state.clock.elapsedTime * speed + index;
      particleRef.current.position.x = Math.cos(time) * radius;
      particleRef.current.position.y = height + Math.sin(time * 0.6) * 3;
      particleRef.current.position.z = Math.sin(time) * radius;
      
      const opacity = 0.3 + Math.sin(state.clock.elapsedTime * 4 + index) * 0.4;
      if (particleRef.current.material) {
        (particleRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, opacity);
      }
    }
  });
  
  const colors = ['#00ffff', '#ff0080', '#8000ff', '#0080ff', '#00ff80', '#ff8000'];
  const color = colors[index % colors.length];
  
  return (
    <Sphere ref={particleRef} args={[size]} position={[0, 0, 0]}>
      <meshBasicMaterial 
        color={color}
        transparent
        opacity={0.6}
      />
    </Sphere>
  );
}

// Detection result display nodes
function DetectionNode({ 
  object, 
  position, 
  index 
}: { 
  object: string; 
  position: [number, number, number]; 
  index: number 
}) {
  const nodeRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (nodeRef.current) {
      nodeRef.current.rotation.y += delta * (0.3 + index * 0.1);
      nodeRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + index) * 0.8;
    }
    
    if (sphereRef.current) {
      const scale = 1.3 + Math.sin(state.clock.elapsedTime * 3 + index) * 0.3;
      sphereRef.current.scale.setScalar(scale);
    }
  });
  
  const nodeColors = [
    '#00ff00', '#ff3300', '#3300ff', '#ffff00', 
    '#ff00ff', '#00ffff', '#ff8800', '#8800ff'
  ];
  const color = nodeColors[index % nodeColors.length];
  
  return (
    <group ref={nodeRef} position={position}>
      {/* Main detection sphere */}
      <Sphere ref={sphereRef} args={[0.4]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          transparent
          opacity={0.8}
        />
      </Sphere>
      
      {/* Orbital ring */}
      <Ring args={[0.6, 0.8, 32]} position={[0, 0, 0]}>
        <meshBasicMaterial 
          color={color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </Ring>
      
      {/* Connection beam to center */}
      <Cylinder
        args={[0.02, 0.02, 12]}
        position={[position[0] * 0.5, 0, position[2] * 0.5]}
        rotation={[0, 0, Math.atan2(position[2], position[0])]}
      >
        <meshBasicMaterial 
          color={color}
          transparent
          opacity={0.3}
        />
      </Cylinder>
      
      {/* Object label */}
      <Text
        position={[0, -1.2, 0]}
        fontSize={0.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={3}
      >
        {object.replace(/\([^)]*\)/g, '').trim().toUpperCase()}
      </Text>
    </group>
  );
}

// Animated background environment
function AnimatedBackground() {
  return (
    <>
      <Stars 
        radius={150} 
        depth={80} 
        count={8000} 
        factor={6} 
        saturation={0} 
        fade 
        speed={2}
      />
      
      {/* Floating geometric shapes */}
      {Array.from({ length: 25 }).map((_, i) => (
        <FloatingShape key={i} index={i} />
      ))}
      
      {/* Grid floor */}
      <gridHelper 
        args={[100, 100, '#004488', '#002244']} 
        position={[0, -15, 0]} 
      />
    </>
  );
}

function FloatingShape({ index }: { index: number }) {
  const shapeRef = useRef<THREE.Mesh>(null);
  const radius = 20 + Math.random() * 30;
  const speed = 0.05 + Math.random() * 0.15;
  const rotSpeed = 0.01 + Math.random() * 0.02;
  
  useFrame((state) => {
    if (shapeRef.current) {
      const time = state.clock.elapsedTime * speed + index;
      shapeRef.current.position.x = Math.cos(time) * radius;
      shapeRef.current.position.y = Math.sin(time * 0.8) * 15;
      shapeRef.current.position.z = Math.sin(time) * radius;
      
      shapeRef.current.rotation.x += rotSpeed;
      shapeRef.current.rotation.y += rotSpeed * 0.7;
      shapeRef.current.rotation.z += rotSpeed * 0.5;
    }
  });
  
  const shapes = [
    <Box args={[1, 1, 1]} />,
    <Sphere args={[0.6]} />,
    <Torus args={[0.6, 0.2, 16, 32]} />,
    <Cylinder args={[0.4, 0.4, 1.2]} />
  ];
  
  const ShapeComponent = shapes[index % 4];
  const color = `hsl(${index * 30}, 70%, 30%)`;
  
  return (
    <mesh ref={shapeRef}>
      {ShapeComponent}
      <meshBasicMaterial 
        color={color}
        transparent
        opacity={0.15}
        wireframe
      />
    </mesh>
  );
}

// Main Application Component
function App() {
  // State management
  const [aiResponse, setAiResponse] = useState<string>('AI Neural Interface Online');
  const [connectionStatus, setConnectionStatus] = useState<string>('Establishing Neural Link...');
  const [aiStatus, setAiStatus] = useState<AIResponse | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [autoAnalysis, setAutoAnalysis] = useState<boolean>(false);
  const [objectCount, setObjectCount] = useState<number>(0);
  const [detectionMethod, setDetectionMethod] = useState<string>('Neural Network Initializing');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize on component mount
  useEffect(() => {
    checkConnection();
    getAIStatus();
  }, []);

  // Auto-analysis loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoAnalysis && cameraActive) {
      interval = setInterval(() => {
        analyzeFrame();
      }, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoAnalysis, cameraActive]);

  // API Functions
  const checkConnection = async () => {
    try {
      const response = await axios.get('http://localhost:8000/');
      setConnectionStatus(`Neural Link Active - ${response.data.detection_mode || 'Connected'}`);
    } catch (error) {
      setConnectionStatus('Neural Link Offline - Backend Disconnected');
    }
  };

  const getAIStatus = async () => {
    try {
      const response = await axios.get('http://localhost:8000/ai/status');
      setAiStatus(response.data);
      setDetectionMethod(response.data.yolo_available ? 'YOLO v8 Neural Network' : 'Basic Vision Processing');
    } catch (error) {
      console.error('AI status check failed');
      setDetectionMethod('Connection Failed');
    }
  };

  const startCamera = async () => {
    setIsAnalyzing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 },
          facingMode: 'environment'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setAiResponse('Visual Sensors Active - Neural Processing Online');
      }
    } catch (error) {
      setAiResponse('Camera Access Denied - Check Browser Permissions');
      console.error('Camera error:', error);
    }
    setIsAnalyzing(false);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setAutoAnalysis(false);
    setAiResponse('Visual Sensors Offline');
  };

  const analyzeFrame = async () => {
    if (!videoRef.current || !cameraActive || isAnalyzing) return;

    setIsAnalyzing(true);
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      
      if (ctx && videoRef.current.videoWidth > 0) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        
        const response = await axios.post('http://localhost:8000/ai/analyze-frame', {
          image: imageData
        });
        
        const objects = response.data.objects || [];
        setDetectedObjects(objects);
        setObjectCount(response.data.object_count || 0);
        
        const resultText = objects.length > 0 ? objects.join(', ') : 'No entities detected';
        setAiResponse(`Neural Analysis: ${resultText}`);
        
      }
    } catch (error) {
      setAiResponse('Analysis Failed - Neural Link Disrupted');
      console.error('Analysis error:', error);
    }
    
    setIsAnalyzing(false);
  };

  const toggleAutoAnalysis = () => {
    setAutoAnalysis(!autoAnalysis);
    setAiResponse(autoAnalysis ? 'Autonomous Monitoring Deactivated' : 'Autonomous Monitoring Activated');
  };

  const testConnection = async () => {
    setIsAnalyzing(true);
