{/* Analysis History */}
        {analysisHistory.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h4 style={{ color: '#00ffff', margin: '0 0 10px 0' }}>📝 Recent Analysis:</h4>
            <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '11px' }}>
              {analysisHistory.map((entry, index) => (
                <p key={index} style={{ margin: '2px 0', color: '#ccc' }}>
                  {entry}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Enhanced 3D Scene */}
      <Canvas camera={{ position: [0, 2, 8], fov: 60 }}>
        {/* Enhanced lighting */}
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.2} />
        <pointLight position={[-10, -10, -10]} intensity={0.8} color="#4080ff" />
        
        {/* Main rotating cube */}
        <RotatingCube />
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        {/* Main AI response text */}
        <Text
          position={[0, 3, 0]}
          fontSize={0.4}
          color="cyan"
          anchorX="center"
          anchorY="middle"
          maxWidth={8}
        >
          {aiResponse}
        </Text>

        {/* Status text */}
        <Text
          position={[0, -2.5, 0]}
          fontSize={0.25}
          color="lime"
          anchorX="center"
          anchorY="middle"
        >
          {detectionMethod} - {objectCount} objects detected
        </Text>

        {/* Enhanced object visualization with spheres */}
        {detectedObjects.map((object, index) => (
          <DetectedObjectSphere
            key={`${object}-${index}`}
            object={object}
            position={getObjectPosition(index, detectedObjects.length)}
            index={index}
          />
        ))}

        {/* Background particles effect */}
        {Array.from({ length: 20 }).map((_, index) => (
          <Sphere
            key={`particle-${index}`}
            args={[0.02]}
            position={[
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 20,
              (Math.random() - 0.5) * 20
            ]}
          >
            <meshBasicMaterial color="white" opacity={0.3} transparent />
          </Sphere>
        ))}
      </Canvas>
    </div>
  );
}

// Helper function for consistent button styling
const buttonStyle = (backgroundColor: string) => ({
  padding: '8px 12px',
  background: backgroundColor,
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 'bold' as const,
  transition: 'all 0.3s ease',
  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
});

export default App;
});

export default App;     </h1>
