
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
    try {
      const response = await axios.get('http://localhost:8000/ai/test');
      setAiResponse(response.data.response || 'Connection Test Successful');
    } catch (error) {
      setAiResponse('Connection Test Failed - Check Backend');
    }
    setIsAnalyzing(false);
  };

  // Calculate positions for detection nodes
  const getNodePosition = (index: number, total: number): [number, number, number] => {
    const radius = 10;
    const angle = (index / Math.max(total, 1)) * Math.PI * 2;
    const height = Math.sin(index * 0.8) * 3;
    return [
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    ];
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: 'linear-gradient(135deg, #0a0a23 0%, #1a1a3a 50%, #0f0f2a 100%)',
      overflow: 'hidden',
      fontFamily: "'Orbitron', 'Courier New', monospace"
    }}>
      
      {/* Premium Camera Interface */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: '420px',
        height: '320px',
        background: 'linear-gradient(145deg, rgba(0,40,80,0.95), rgba(0,60,120,0.9))',
        border: '3px solid',
        borderColor: cameraActive ? '#00ffff' : '#555',
        borderRadius: '25px',
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        boxShadow: cameraActive 
          ? '0 0 50px rgba(0,255,255,0.7), inset 0 0 30px rgba(0,255,255,0.1)' 
          : '0 0 30px rgba(0,0,0,0.8)',
        transition: 'all 0.3s ease'
      }}>
        {/* Camera header */}
        <div style={{
          padding: '15px',
          background: 'linear-gradient(90deg, rgba(0,255,255,0.2), rgba(0,255,255,0.05))',
          borderBottom: '2px solid rgba(0,255,255,0.3)',
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#00ffff',
          textAlign: 'center',
          fontWeight: 'bold',
          letterSpacing: '2px'
        }}>
          🔭 QUANTUM VISUAL SENSOR ARRAY
        </div>
        
        {/* Video display */}
        <div style={{ position: 'relative', height: 'calc(100% - 60px)' }}>
          <video 
            ref={videoRef}
            autoPlay 
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: cameraActive ? 'block' : 'none'
            }}
          />
          
          {!cameraActive && (
            <div style={{ 
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              color: '#00aaff', 
              textAlign: 'center',
              fontFamily: 'monospace'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.6 }}>📡</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>VISUAL SENSORS</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>OFFLINE</div>
            </div>
          )}
          
          {/* Analysis overlay */}
          {isAnalyzing && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00ffff',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              🔄 ANALYZING...
            </div>
          )}
        </div>
      </div>

      {/* Advanced Control Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'linear-gradient(135deg, rgba(0,20,50,0.98), rgba(0,50,100,0.95))',
        border: '3px solid #00aaff',
        borderRadius: '30px',
        padding: '35px',
        fontFamily: 'monospace',
        color: '#00ffff',
        backdropFilter: 'blur(25px)',
        boxShadow: '0 0 80px rgba(0,170,255,0.5), inset 0 0 40px rgba(0,255,255,0.1)',
        minWidth: '450px',
        maxHeight: '85vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ 
          textAlign: 'center',
          marginBottom: '30px',
          borderBottom: '3px solid #00ffff',
          paddingBottom: '20px'
        }}>
          <h1 style={{ 
            margin: '0',
            fontSize: '24px',
            textShadow: '0 0 15px #00ffff',
            letterSpacing: '3px',
            fontWeight: 'bold'
          }}>
            🧠 AI NEURAL COMMAND CENTER
          </h1>
          <div style={{ 
            fontSize: '12px', 
            marginTop: '8px', 
            opacity: 0.8,
            letterSpacing: '1px'
          }}>
            QUANTUM PROCESSING ENABLED
          </div>
        </div>
        
        {/* Status Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '20px',
          marginBottom: '30px',
          fontSize: '13px'
        }}>
          <div style={{ 
            background: 'rgba(0,255,255,0.1)', 
            padding: '15px', 
            borderRadius: '15px',
            border: '1px solid rgba(0,255,255,0.3)'
          }}>
            <div style={{ color: '#88ffff', marginBottom: '8px', fontWeight: 'bold' }}>NEURAL LINK</div>
            <div style={{ 
              color: connectionStatus.includes('Active') ? '#00ff00' : '#ff4444',
              fontSize: '11px',
              wordBreak: 'break-word'
            }}>
              {connectionStatus}
            </div>
          </div>
          
          <div style={{ 
            background: 'rgba(0,255,255,0.1)', 
            padding: '15px', 
            borderRadius: '15px',
            border: '1px solid rgba(0,255,255,0.3)'
          }}>
            <div style={{ color: '#88ffff', marginBottom: '8px', fontWeight: 'bold' }}>DETECTION MODE</div>
            <div style={{ color: '#ffffff', fontSize: '11px' }}>
              {detectionMethod}
            </div>
          </div>
          
          <div style={{ 
            background: 'rgba(0,255,255,0.1)', 
            padding: '15px', 
            borderRadius: '15px',
            border: '1px solid rgba(0,255,255,0.3)'
          }}>
            <div style={{ color: '#88ffff', marginBottom: '8px', fontWeight: 'bold' }}>VISUAL STATUS</div>
            <div style={{ 
              color: cameraActive ? '#00ff00' : '#ff4444',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              {cameraActive ? 'SENSORS ONLINE' : 'SENSORS OFFLINE'}
            </div>
          </div>
          
          <div style={{ 
            background: 'rgba(0,255,255,0.1)', 
            padding: '15px', 
            borderRadius: '15px',
            border: '1px solid rgba(0,255,255,0.3)'
          }}>
            <div style={{ color: '#88ffff', marginBottom: '8px', fontWeight: 'bold' }}>AUTO ANALYSIS</div>
            <div style={{ 
              color: autoAnalysis ? '#ffaa00' : '#8888ff',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              {autoAnalysis ? 'AUTONOMOUS MODE' : 'MANUAL MODE'}
            </div>
          </div>
        </div>

        {/* Neural Response Display */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,255,255,0.15), rgba(0,255,255,0.05))',
          border: '2px solid rgba(0,255,255,0.4)',
          borderRadius: '20px',
          padding: '25px',
          marginBottom: '30px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ 
            fontSize: '12px', 
            color: '#88ffff', 
            marginBottom: '12px',
            fontWeight: 'bold',
            letterSpacing: '1px'
          }}>
            NEURAL RESPONSE MATRIX
          </div>
          <div style={{ 
            fontSize: '14px', 
            lineHeight: '1.6',
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {aiResponse}
          </div>
          {objectCount > 0 && (
            <div style={{ 
              fontSize: '12px', 
              marginTop: '15px', 
              color: '#00ff88',
              fontWeight: 'bold',
              padding: '8px',
              background: 'rgba(0,255,136,0.1)',
              borderRadius: '10px'
            }}>
              {objectCount} QUANTUM ENTITIES DETECTED
            </div>
          )}
          
          {/* Animated scanning line */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #00ffff, transparent)',
            animation: isAnalyzing ? 'scan 2s linear infinite' : 'none'
          }} />
        </div>

        {/* Control Buttons */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '15px',
          marginBottom: '25px'
        }}>
          <button 
            onClick={cameraActive ? stopCamera : startCamera}
            style={ultraButtonStyle(cameraActive ? '#ff4400' : '#00ff88', true)}
            disabled={isAnalyzing}
          >
            {cameraActive ? '⏹ DEACTIVATE SENSORS' : '📡 ACTIVATE SENSORS'}
          </button>
          
          <button 
            onClick={analyzeFrame}
            disabled={!cameraActive || isAnalyzing}
            style={ultraButtonStyle('#0088ff', cameraActive && !isAnalyzing)}
          >
            ⚡ NEURAL SCAN
          </button>
          
          <button 
            onClick={toggleAutoAnalysis}
            disabled={!cameraActive}
            style={ultraButtonStyle(autoAnalysis ? '#ff8800' : '#8800ff', cameraActive)}
          >
            {autoAnalysis ? '⏸ DISABLE AUTO' : '▶ ENABLE AUTO'}
          </button>
          
          <button 
            onClick={testConnection}
            style={ultraButtonStyle('#ff0088', true)}
            disabled={isAnalyzing}
          >
            🔄 SYSTEM CHECK
          </button>
        </div>

        {/* System Information */}
        {aiStatus && (
          <div style={{ 
            fontSize: '11px', 
            color: '#888',
            borderTop: '2px solid rgba(0,255,255,0.2)',
            paddingTop: '20px',
            background: 'rgba(0,0,0,0.2)',
            padding: '15px',
            borderRadius: '15px'
          }}>
            <div style={{ marginBottom: '8px', color: '#00aaff', fontWeight: 'bold' }}>SYSTEM DIAGNOSTICS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>PyTorch: {aiStatus.pytorch}</div>
              <div>OpenCV: {aiStatus.opencv}</div>
              <div>YOLO: {aiStatus.yolo_available ? 'Available' : 'Not Available'}</div>
              {aiStatus.detection_classes && (
                <div>Classes: {aiStatus.detection_classes}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Premium 3D Scene */}
      <Canvas 
        camera={{ position: [0, 10, 20], fov: 60 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        {/* Enhanced lighting setup */}
        <ambientLight intensity={0.2} />
        <pointLight position={[20, 20, 20]} intensity={2.5} color="#ffffff" />
        <pointLight position={[-20, -20, -20]} intensity={2} color="#0080ff" />
        <pointLight position={[0, 0, 25]} intensity={1.8} color="#ff0080" />
        <spotLight 
          position={[0, 30, 0]} 
          intensity={1.5} 
          angle={Math.PI / 4} 
          penumbra={0.3}
          color="#00ffff"
          castShadow
        />
        
        {/* Animated background */}
        <AnimatedBackground />
        
        {/* Central AI Core */}
        <AICore />
        
        {/* Enhanced camera controls */}
        <OrbitControls 
          enableDamping 
          dampingFactor={0.02}
          enableZoom={true}
          enablePan={true}
          autoRotate={true}
          autoRotateSpeed={0.2}
          minDistance={12}
          maxDistance={50}
          maxPolarAngle={Math.PI * 0.8}
        />
        
        {/* Main system status display */}
        <Text
          position={[0, 15, 0]}
          fontSize={1}
          color="#00ffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={25}
          textAlign="center"
        >
          {detectionMethod.toUpperCase()}
        </Text>

        {/* Detection nodes */}
        {detectedObjects.map((object, index) => (
          <DetectionNode
            key={`${object}-${index}`}
            object={object}
            position={getNodePosition(index, detectedObjects.length)}
            index={index}
          />
        ))}

        {/* Status display */}
        <Text
          position={[0, -12, 0]}
          fontSize={0.5}
          color="#88ffff"
          anchorX="center"
          anchorY="middle"
        >
          {objectCount > 0 
            ? `${objectCount} QUANTUM ENTITIES DETECTED AND TRACKED`
            : 'SCANNING QUANTUM ENVIRONMENT...'
          }
        </Text>
        
        {/* Connection status indicator */}
        <Text
          position={[0, -14, 0]}
          fontSize={0.3}
          color={connectionStatus.includes('Active') ? '#00ff00' : '#ff4444'}
          anchorX="center"
          anchorY="middle"
        >
          {connectionStatus.toUpperCase()}
        </Text>
      </Canvas>
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes scan {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
      `}</style>
    </div>
  );
}

// Ultra-premium button styling
const ultraButtonStyle = (color: string, enabled: boolean = true) => ({
  background: enabled 
    ? `linear-gradient(145deg, ${color}33, ${color}66, ${color}33)`
    : 'linear-gradient(145deg, #333, #555, #333)',
  border: `3px solid ${enabled ? color : '#666'}`,
  color: enabled ? '#ffffff' : '#999',
  padding: '15px 20px',
  borderRadius: '18px',
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontSize: '12px',
  fontWeight: 'bold' as const,
  fontFamily: 'monospace',
  textTransform: 'uppercase' as const,
  transition: 'all 0.4s ease',
  backdropFilter: 'blur(15px)',
  textShadow: enabled ? `0 0 10px ${color}` : 'none',
  boxShadow: enabled 
    ? `0 0 25px ${color}66, inset 0 0 15px ${color}33, 0 5px 15px rgba(0,0,0,0.3)`
    : '0 0 10px #33333344',
  letterSpacing: '1px',
  position: 'relative' as const,
  overflow: 'hidden' as const
});

export default App;