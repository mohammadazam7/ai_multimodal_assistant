import React, { useState, useRef, useEffect } from 'react';
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
  useTexture
} from '@react-three/drei';
import * as THREE from 'three';
import axios from 'axios';
import './App.css';

// AI Response interface
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

// Animated central AI core with particle effects
function AICore() {
  const coreRef = useRef<THREE.Group>(null);
  const innerCoreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.2;
    }
    
    if (innerCoreRef.current) {
      innerCoreRef.current.rotation.x += delta * 0.8;
      innerCoreRef.current.rotation.y += delta * 0.5;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      innerCoreRef.current.scale.setScalar(scale);
    }
    
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 1.2;
      ring1Ref.current.rotation.z += delta * 0.8;
    }
    
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y += delta * 1.5;
      ring2Ref.current.rotation.z -= delta * 1.0;
    }
    
    if (ring3Ref.current) {
      ring3Ref.current.rotation.x -= delta * 0.9;
      ring3Ref.current.rotation.y += delta * 0.6;
    }
  });
  
  return (
    <group ref={coreRef} position={[0, 0, 0]}>
      {/* Central pulsing core */}
      <Sphere ref={innerCoreRef} args={[1.2]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#00ffff" 
          emissive="#006666"
          transparent
          opacity={0.8}
          wireframe={false}
        />
      </Sphere>
      
      {/* Inner energy core */}
      <Sphere args={[0.6]} position={[0, 0, 0]}>
        <meshBasicMaterial 
          color="#ffffff" 
          transparent
          opacity={0.9}
        />
      </Sphere>
      
      {/* Rotating orbital rings */}
      <Ring ref={ring1Ref} args={[2.5, 2.8, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#ff0080" 
          emissive="#440020"
          side={THREE.DoubleSide}
          transparent
          opacity={0.8}
        />
      </Ring>
      
      <Ring ref={ring2Ref} args={[3.8, 4.2, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#8000ff" 
          emissive="#200044"
          side={THREE.DoubleSide}
          transparent
          opacity={0.7}
        />
      </Ring>
      
      <Ring ref={ring3Ref} args={[5.2, 5.8, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#0080ff" 
          emissive="#002044"
          side={THREE.DoubleSide}
          transparent
          opacity={0.6}
        />
      </Ring>
      
      {/* Energy particles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <EnergyParticle key={i} index={i} />
      ))}
    </group>
  );
}

// Floating energy particles
function EnergyParticle({ index }: { index: number }) {
  const particleRef = useRef<THREE.Mesh>(null);
  const radius = 6 + Math.random() * 4;
  const speed = 0.3 + Math.random() * 0.7;
  const height = (Math.random() - 0.5) * 8;
  
  useFrame((state) => {
    if (particleRef.current) {
      const time = state.clock.elapsedTime * speed + index;
      particleRef.current.position.x = Math.cos(time) * radius;
      particleRef.current.position.y = height + Math.sin(time * 0.5) * 2;
      particleRef.current.position.z = Math.sin(time) * radius;
      
      // Particle glow effect
      const opacity = 0.3 + Math.sin(state.clock.elapsedTime * 3 + index) * 0.3;
      if (particleRef.current.material) {
        (particleRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
      }
    }
  });
  
  return (
    <Sphere ref={particleRef} args={[0.08]} position={[0, 0, 0]}>
      <meshBasicMaterial 
        color={`hsl(${180 + index * 10}, 100%, 70%)`}
        transparent
        opacity={0.6}
      />
    </Sphere>
  );
}

// Holographic detection display
function HolographicDisplay({ 
  objects, 
  position 
}: { 
  objects: string[]; 
  position: [number, number, number] 
}) {
  const displayRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (displayRef.current) {
      displayRef.current.rotation.y += delta * 0.1;
      displayRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });
  
  return (
    <group ref={displayRef} position={position}>
      {/* Holographic panel background */}
      <Plane args={[4, 2.5]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color="#001133"
          transparent
          opacity={0.3}
          emissive="#002255"
          side={THREE.DoubleSide}
        />
      </Plane>
      
      {/* Panel frame */}
      <Box args={[4.2, 2.7, 0.05]} position={[0, 0, -0.1]}>
        <meshBasicMaterial 
          color="#00aaff"
          transparent
          opacity={0.8}
          wireframe
        />
      </Box>
      
      {/* Display detected objects */}
      {objects.map((object, index) => (
        <Text
          key={index}
          position={[0, 0.8 - index * 0.4, 0.1]}
          fontSize={0.2}
          color="#00ffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={3.5}
        >
          {`> ${object.toUpperCase()}`}
        </Text>
      ))}
      
      {/* Scanning lines effect */}
      {Array.from({ length: 10 }).map((_, i) => (
        <Cylinder
          key={i}
          args={[0.005, 0.005, 4]}
          position={[-1.8 + i * 0.4, 0, 0.05]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshBasicMaterial 
            color="#00ffff"
            transparent
            opacity={0.3}
          />
        </Cylinder>
      ))}
    </group>
  );
}

// Floating data nodes for each detected object
function DataNode({ 
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
      nodeRef.current.rotation.y += delta * (0.5 + index * 0.1);
      nodeRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + index) * 0.5;
    }
    
    if (sphereRef.current) {
      const scale = 1.2 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.2;
      sphereRef.current.scale.setScalar(scale);
    }
  });
  
  const nodeColor = `hsl(${120 + index * 60}, 80%, 60%)`;
  
  return (
    <group ref={nodeRef} position={position}>
      {/* Main node sphere */}
      <Sphere ref={sphereRef} args={[0.3]} position={[0, 0, 0]}>
        <meshStandardMaterial 
          color={nodeColor}
          emissive={nodeColor}
          emissiveIntensity={0.3}
          transparent
          opacity={0.8}
        />
      </Sphere>
      
      {/* Orbital ring around node */}
      <Ring args={[0.5, 0.6, 32]} position={[0, 0, 0]}>
        <meshBasicMaterial 
          color={nodeColor}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </Ring>
      
      {/* Object label */}
      <Text
        position={[0, -0.8, 0]}
        fontSize={0.15}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        maxWidth={2}
      >
        {object.replace(/\([^)]*\)/g, '').trim().toUpperCase()}
      </Text>
      
      {/* Connection lines to center */}
      <Cylinder
        args={[0.01, 0.01, 8]}
        position={[0, 0, 0]}
        rotation={[0, 0, Math.atan2(position[2], position[0])]}
      >
        <meshBasicMaterial 
          color={nodeColor}
          transparent
          opacity={0.3}
        />
      </Cylinder>
    </group>
  );
}

// Dynamic background environment
function Environment() {
  return (
    <>
      <Stars 
        radius={100} 
        depth={50} 
        count={5000} 
        factor={4} 
        saturation={0} 
        fade 
        speed={1}
      />
      
      {/* Floating geometric shapes */}
      {Array.from({ length: 15 }).map((_, i) => (
        <FloatingGeometry key={i} index={i} />
      ))}
    </>
  );
}

function FloatingGeometry({ index }: { index: number }) {
  const geometryRef = useRef<THREE.Mesh>(null);
  const radius = 15 + Math.random() * 20;
  const speed = 0.1 + Math.random() * 0.2;
  
  useFrame((state) => {
    if (geometryRef.current) {
      const time = state.clock.elapsedTime * speed + index;
      geometryRef.current.position.x = Math.cos(time) * radius;
      geometryRef.current.position.y = Math.sin(time * 0.7) * 10;
      geometryRef.current.position.z = Math.sin(time) * radius;
      
      geometryRef.current.rotation.x += 0.01;
      geometryRef.current.rotation.y += 0.01;
    }
  });
  
  const shapes = [
    <Box args={[0.5, 0.5, 0.5]} />,
    <Sphere args={[0.3]} />,
    <Torus args={[0.3, 0.1, 16, 32]} />
  ];
  
  const ShapeComponent = shapes[index % 3];
  
  return (
    <mesh ref={geometryRef}>
      {ShapeComponent}
      <meshBasicMaterial 
        color={`hsl(${index * 25}, 60%, 40%)`}
        transparent
        opacity={0.2}
        wireframe
      />
    </mesh>
  );
}

// Main App Component
function App() {
  const [aiResponse, setAiResponse] = useState<string>('AI Neural Interface Initializing...');
  const [connectionStatus, setConnectionStatus] = useState<string>('Establishing Neural Link...');
  const [aiStatus, setAiStatus] = useState<AIResponse | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [autoAnalysis, setAutoAnalysis] = useState<boolean>(false);
  const [objectCount, setObjectCount] = useState<number>(0);
  const [detectionMethod, setDetectionMethod] = useState<string>('Neural Network Initializing');
  
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    checkConnection();
    getAIStatus();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoAnalysis && cameraActive) {
      interval = setInterval(() => {
        analyzeFrame();
      }, 2500);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoAnalysis, cameraActive]);

  const checkConnection = async () => {
    try {
      const response = await axios.get('http://localhost:8000/');
      setConnectionStatus(`Neural Link Active - ${response.data.detection_mode || 'Connected'}`);
    } catch (error) {
      setConnectionStatus('Neural Link Offline - Check Backend');
    }
  };

  const getAIStatus = async () => {
    try {
      const response = await axios.get('http://localhost:8000/ai/status');
      setAiStatus(response.data);
      setDetectionMethod(response.data.yolo_available ? 'YOLO v8 Neural Network' : 'Basic Edge Detection');
    } catch (error) {
      console.error('AI status check failed');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'environment'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        setAiResponse('Visual Sensors Online - Neural Processing Ready');
      }
    } catch (error) {
      setAiResponse('Visual Sensor Access Denied - Check Permissions');
    }
  };

  const analyzeFrame = async () => {
    if (!videoRef.current || !cameraActive) return;

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    if (ctx && videoRef.current.videoWidth > 0) {
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      
      try {
        const response = await axios.post('http://localhost:8000/ai/analyze-frame', {
          image: imageData
        });
        
        const objects = response.data.objects || [];
        setDetectedObjects(objects);
        setObjectCount(response.data.object_count || 0);
        
        const resultText = objects.length > 0 ? objects.join(', ') : 'No entities detected';
        setAiResponse(`Neural Analysis Complete: ${resultText}`);
        
      } catch (error) {
        setAiResponse('Analysis Failed - Neural Link Disrupted');
      }
    }
  };

  const toggleAutoAnalysis = () => {
    setAutoAnalysis(!autoAnalysis);
    setAiResponse(autoAnalysis ? 'Autonomous Monitoring Deactivated' : 'Autonomous Monitoring Activated');
  };

  const getDataNodePosition = (index: number, total: number): [number, number, number] => {
    const radius = 8;
    const angle = (index / Math.max(total, 1)) * Math.PI * 2;
    const height = Math.sin(index * 0.5) * 2;
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
      background: 'radial-gradient(ellipse at center, #001122 0%, #000511 100%)',
      overflow: 'hidden'
    }}>
      {/* Premium camera display */}
      <div style={{
        position: 'absolute',
        top: '25px',
        right: '25px',
        width: '380px',
        height: '280px',
        background: 'linear-gradient(145deg, rgba(0,30,60,0.9), rgba(0,50,100,0.8))',
        border: cameraActive ? '3px solid #00ffff' : '3px solid #444',
        borderRadius: '20px',
        overflow: 'hidden',
        backdropFilter: 'blur(15px)',
        boxShadow: cameraActive 
          ? '0 0 40px rgba(0,255,255,0.6), inset 0 0 20px rgba(0,255,255,0.1)' 
          : '0 0 20px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '10px',
          background: 'rgba(0,255,255,0.1)',
          borderBottom: '1px solid #00ffff',
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#00ffff',
          textAlign: 'center'
        }}>
          VISUAL SENSOR ARRAY
        </div>
        
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
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00ffff', 
            textAlign: 'center',
            fontFamily: 'monospace',
            fontSize: '14px'
          }}>
            <div>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>◉</div>
              Visual Sensors<br/>Offline
            </div>
          </div>
        )}
      </div>

      {/* Premium control interface */}
      <div style={{
        position: 'absolute',
        top: '25px',
        left: '25px',
        background: 'linear-gradient(135deg, rgba(0,20,40,0.95), rgba(0,40,80,0.9))',
        border: '2px solid #00aaff',
        borderRadius: '25px',
        padding: '30px',
        fontFamily: 'monospace',
        color: '#00ffff',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 60px rgba(0,170,255,0.4), inset 0 0 30px rgba(0,255,255,0.1)',
        minWidth: '400px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <div style={{ 
          textAlign: 'center',
          marginBottom: '25px',
          borderBottom: '2px solid #00ffff',
          paddingBottom: '15px'
        }}>
          <h1 style={{ 
            margin: '0',
            fontSize: '20px',
            textShadow: '0 0 10px #00ffff',
            letterSpacing: '2px'
          }}>
            AI NEURAL INTERFACE
          </h1>
          <div style={{ fontSize: '10px', marginTop: '5px', opacity: 0.7 }}>
            QUANTUM PROCESSING ENABLED
          </div>
        </div>
        
        <div style={{ marginBottom: '25px' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '15px',
            fontSize: '12px'
          }}>
            <div>
              <div style={{ color: '#88ffff', marginBottom: '5px' }}>NEURAL LINK</div>
              <div style={{ 
                color: connectionStatus.includes('Active') ? '#00ff00' : '#ff4444',
                fontSize: '11px'
              }}>
                {connectionStatus}
              </div>
            </div>
            
            <div>
              <div style={{ color: '#88ffff', marginBottom: '5px' }}>DETECTION MODE</div>
              <div style={{ color: '#ffffff', fontSize: '11px' }}>
                {detectionMethod}
              </div>
            </div>
            
            <div>
              <div style={{ color: '#88ffff', marginBottom: '5px' }}>VISUAL STATUS</div>
              <div style={{ 
                color: cameraActive ? '#00ff00' : '#ff4444',
                fontSize: '11px'
              }}>
                {cameraActive ? 'SENSORS ONLINE' : 'SENSORS OFFLINE'}
              </div>
            </div>
            
            <div>
              <div style={{ color: '#88ffff', marginBottom: '5px' }}>AUTO ANALYSIS</div>
              <div style={{ 
                color: autoAnalysis ? '#ffaa00' : '#8888ff',
                fontSize: '11px'
              }}>
                {autoAnalysis ? 'AUTONOMOUS MODE' : 'MANUAL MODE'}
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(90deg, rgba(0,255,255,0.1), rgba(0,255,255,0.05))',
          border: '1px solid rgba(0,255,255,0.3)',
          borderRadius: '15px',
          padding: '20px',
          marginBottom: '25px',
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: '10px', 
            color: '#88ffff', 
            marginBottom: '8px' 
          }}>
            NEURAL RESPONSE
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
            {aiResponse}
          </div>
          {objectCount > 0 && (
            <div style={{ 
              fontSize: '11px', 
              marginTop: '10px', 
              color: '#00ff88' 
            }}>
              {objectCount} ENTITIES DETECTED
            </div>
          )}
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '12px',
          marginBottom: '20px'
        }}>
          <button 
            onClick={startCamera}
            style={premiumButtonStyle('#00ff88', cameraActive)}
          >
            {cameraActive ? '● SENSORS ACTIVE' : '○ ACTIVATE SENSORS'}
          </button>
          
          <button 
            onClick={analyzeFrame}
            disabled={!cameraActive}
            style={premiumButtonStyle('#0088ff', cameraActive)}
          >
            ⚡ NEURAL SCAN
          </button>
          
          <button 
            onClick={toggleAutoAnalysis}
            disabled={!cameraActive}
            style={premiumButtonStyle(autoAnalysis ? '#ff8800' : '#8800ff', cameraActive)}
          >
            {autoAnalysis ? '⏹ DISABLE AUTO' : '▶ ENABLE AUTO'}
          </button>
          
          <button 
            onClick={checkConnection}
            style={premiumButtonStyle('#ff0088', true)}
          >
            🔄 SYSTEM CHECK
          </button>
        </div>

        {aiStatus && (
          <div style={{ 
            fontSize: '10px', 
            color: '#888',
            borderTop: '1px solid #333',
            paddingTop: '15px'
          }}>
            <div>PyTorch: {aiStatus.pytorch}</div>
            <div>OpenCV: {aiStatus.opencv}</div>
            <div>YOLO: {aiStatus.yolo_available ? 'Available' : 'Not Available'}</div>
            {aiStatus.detection_classes && (
              <div>Classes: {aiStatus.detection_classes}</div>
            )}
          </div>
        )}
      </div>

      {/* Premium 3D Scene */}
      <Canvas 
        camera={{ position: [0, 8, 15], fov: 60 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Premium lighting setup */}
        <ambientLight intensity={0.3} />
        <pointLight position={[15, 15, 15]} intensity={2} color="#ffffff" />
        <pointLight position={[-15, -15, -15]} intensity={1.5} color="#0080ff" />
        <pointLight position={[0, 0, 20]} intensity={1.2} color="#ff0080" />
        <spotLight 
          position={[0, 20, 0]} 
          intensity={1} 
          angle={Math.PI / 6} 
          penumbra={0.5}
          color="#00ffff"
        />
        
        {/* Dynamic background environment */}
        <Environment />
        
        {/* Central AI Core */}
        <AICore />
        
        {/* Enhanced camera controls */}
        <OrbitControls 
          enableDamping 
          dampingFactor={0.03}
          enableZoom={true}
          enablePan={true}
          autoRotate={true}
          autoRotateSpeed={0.3}
          minDistance={8}
          maxDistance={30}
        />
        
        {/* Main system status display */}
        <Text
          position={[0, 12, 0]}
          fontSize={0.8}
          color="#00ffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={20}
          textAlign="center"
        >
          {detectionMethod.toUpperCase()}
        </Text>

        {/* Detection results as data nodes */}
        {detectedObjects.map((object, index) => (
          <DataNode
            key={`${object}-${index}`}
            object={object}
            position={getDataNodePosition(index, detectedObjects.length)}
            index={index}
          />
        ))}

        {/* Holographic display panel */}
        {detectedObjects.length > 0 && (
          <HolographicDisplay
            objects={detectedObjects}
            position={[8, 4, 0]}
          />
        )}

        {/* Status information */}
        <Text
          position={[0, -10, 0]}
          fontSize={0.4}
          color="#88ffff"
          anchorX="center"
          anchorY="middle"
        >
          {objectCount > 0 
            ? `${objectCount} NEURAL ENTITIES DETECTED AND TRACKED`
            : 'SCANNING QUANTUM ENVIRONMENT...'
          }
        </Text>
      </Canvas>
    </div>
  );
}

const premiumButtonStyle = (color: string, enabled: boolean = true) => ({
  background: enabled 
    ? `linear-gradient(45deg, ${color}22, ${color}44, ${color}22)`
    : 'linear-gradient(45deg, #333, #555, #333)',
  border: `2px solid ${enabled ? color : '#666'}`,
  color: enabled ? color : '#999',
  padding: '12px 16px',
  borderRadius: '12px',
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontSize: '11px',
  fontWeight: 'bold' as const,
  fontFamily: 'monospace',
  textTransform: 'uppercase' as const,
  transition: 'all 0.3s ease',
  backdropFilter: 'blur(10px)',
  textShadow: enabled ? `0 0 8px ${color}` : 'none',
  boxShadow: enabled 
    ? `0 0 15px ${color}44, inset 0 0 10px ${color}22`
    : '0 0 5px #33333344',
  letterSpacing: '0.5px'
});

export default App;