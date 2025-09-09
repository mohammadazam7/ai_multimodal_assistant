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