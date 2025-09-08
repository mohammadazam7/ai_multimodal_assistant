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
  
  return