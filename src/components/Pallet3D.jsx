import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import '../styles/Pallet3D.css'

// Single board component
function Board({ position, size, color = '#8b5a3c', orientation = 'horizontal' }) {
  const meshRef = useRef()
  
  // No rotation needed - bearers run across width by default
  const rotation = [0, 0, 0]

  return (
    <mesh ref={meshRef} position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.8} 
        metalness={0.1}
      />
    </mesh>
  )
}

// Nail component - small cylinder representing a nail
function Nail({ position }) {
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.04, 0.04, 0.25, 8]} />
      <meshStandardMaterial 
        color="#404040" 
        metalness={0.9} 
        roughness={0.2}
      />
    </mesh>
  )
}

// Dimension line component with arrows and text
function DimensionLine({ start, end, label, offset = 0.3, axis = 'x', color = "#1e40af" }) {
  const midPoint = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2
  ]
  
  const length = Math.sqrt(
    Math.pow(end[0] - start[0], 2) +
    Math.pow(end[1] - start[1], 2) +
    Math.pow(end[2] - start[2], 2)
  )
  
  // Calculate rotation based on axis
  const rotation = axis === 'x' ? [0, 0, 0] : [0, Math.PI / 2, 0]
  
  // Offset position based on axis
  const offsetPos = axis === 'x' 
    ? [midPoint[0], midPoint[1], midPoint[2] + offset]
    : [midPoint[0] + offset, midPoint[1], midPoint[2]]
  
  const startPos = axis === 'x'
    ? [start[0], start[1], start[2] + offset]
    : [start[0] + offset, start[1], start[2]]
    
  const endPos = axis === 'x'
    ? [end[0], end[1], end[2] + offset]
    : [end[0] + offset, end[1], end[2]]
  
  return (
    <group>
      {/* Main dimension line */}
      <mesh position={offsetPos} rotation={rotation}>
        <boxGeometry args={[length, 0.02, 0.02]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* Start arrow */}
      <mesh position={startPos} rotation={axis === 'x' ? [0, Math.PI / 2, Math.PI / 2] : [0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.08, 0.15, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* End arrow */}
      <mesh position={endPos} rotation={axis === 'x' ? [0, -Math.PI / 2, Math.PI / 2] : [0, Math.PI, Math.PI / 2]}>
        <coneGeometry args={[0.08, 0.15, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* Text label - always faces camera */}
      <Text
        position={[offsetPos[0], offsetPos[1] + 0.25, offsetPos[2]]}
        fontSize={0.405}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#ffffff"
        billboard
      >
        {label}
      </Text>
    </group>
  )
}

// Complete pallet structure
function PalletStructure({ quoteData }) {
  const groupRef = useRef()
  
  // Convert mm to 3D units (scale down for better viewing)
  const scale = 0.01 // 1mm = 0.01 units
  
  const palletWidth = quoteData.palletWidth * scale
  const palletDepth = quoteData.palletLength * scale
  const boardWidth = quoteData.boardWidth * scale
  
  // Pallet dimensions
  const boardThickness = 0.22 // ~22mm
  const bearerThickness = 0.75 // ~75mm
  const bearerHeight = 1.0 // ~100mm
  
  // Calculate positions
  const topGap = quoteData.topGapSize * scale
  const bottomGap = quoteData.bottomGapSize * scale
  
  // Auto-rotate
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.2
    }
  })
  
  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Top Boards */}
      {Array.from({ length: quoteData.numberOfTopBoards }).map((_, index) => {
        const xPos = index === 0 
          ? -palletWidth / 2 + boardWidth / 2
          : -palletWidth / 2 + boardWidth / 2 + (index * (boardWidth + topGap))
        
        return (
          <Board
            key={`top-${index}`}
            position={[xPos, bearerHeight / 2 + boardThickness / 2, 0]}
            size={[boardWidth, boardThickness, palletDepth]}
            color="#92400e"
            orientation="horizontal"
          />
        )
      })}
      
      {/* Bearers (Stringers) - Running across the width, distributed along depth */}
      {Array.from({ length: quoteData.numberOfBearers }).map((_, index) => {
        const bearerDepth = 75 * scale // Bearer thickness along depth
        const totalBearerDepth = bearerDepth * quoteData.numberOfBearers
        const availableSpace = palletDepth - totalBearerDepth
        const numberOfGaps = quoteData.numberOfBearers - 1
        const gapSize = numberOfGaps > 0 ? availableSpace / numberOfGaps : 0
        
        // Position along Z-axis (depth), flush with edges
        const zPos = index === 0
          ? -palletDepth / 2 + bearerDepth / 2
          : -palletDepth / 2 + bearerDepth / 2 + (index * (bearerDepth + gapSize))
        
        return (
          <Board
            key={`bearer-${index}`}
            position={[0, 0, zPos]}
            size={[palletWidth, bearerHeight, bearerDepth]}
            color="#ca8a04"
            orientation="bearer"
          />
        )
      })}
      
      {/* Bottom Boards */}
      {Array.from({ length: quoteData.numberOfBottomBoards }).map((_, index) => {
        const xPos = index === 0
          ? -palletWidth / 2 + boardWidth / 2
          : -palletWidth / 2 + boardWidth / 2 + (index * (boardWidth + bottomGap))
        
        return (
          <Board
            key={`bottom-${index}`}
            position={[xPos, -bearerHeight / 2 - boardThickness / 2, 0]}
            size={[boardWidth, boardThickness, palletDepth]}
            color="#713f12"
            orientation="horizontal"
          />
        )
      })}
      
      {/* Nails - 2 nails at each board-bearer intersection */}
      {/* Top board nails */}
      {Array.from({ length: quoteData.numberOfTopBoards }).map((_, boardIndex) => {
        const boardXPos = boardIndex === 0
          ? -palletWidth / 2 + boardWidth / 2
          : -palletWidth / 2 + boardWidth / 2 + (boardIndex * (boardWidth + topGap))
        
        return Array.from({ length: quoteData.numberOfBearers }).map((_, bearerIndex) => {
          const bearerDepth = 75 * scale
          const totalBearerDepth = bearerDepth * quoteData.numberOfBearers
          const availableSpace = palletDepth - totalBearerDepth
          const numberOfGaps = quoteData.numberOfBearers - 1
          const gapSize = numberOfGaps > 0 ? availableSpace / numberOfGaps : 0
          
          const bearerZPos = bearerIndex === 0
            ? -palletDepth / 2 + bearerDepth / 2
            : -palletDepth / 2 + bearerDepth / 2 + (bearerIndex * (bearerDepth + gapSize))
          
          const nailYPos = bearerHeight / 2 + boardThickness / 2
          const nailOffset = boardWidth * 0.15 // Offset nails from center
          
          return (
            <React.Fragment key={`top-nail-${boardIndex}-${bearerIndex}`}>
              <Nail position={[boardXPos - nailOffset, nailYPos, bearerZPos]} />
              <Nail position={[boardXPos + nailOffset, nailYPos, bearerZPos]} />
            </React.Fragment>
          )
        })
      })}
      
      {/* Bottom board nails */}
      {Array.from({ length: quoteData.numberOfBottomBoards }).map((_, boardIndex) => {
        const boardXPos = boardIndex === 0
          ? -palletWidth / 2 + boardWidth / 2
          : -palletWidth / 2 + boardWidth / 2 + (boardIndex * (boardWidth + bottomGap))
        
        return Array.from({ length: quoteData.numberOfBearers }).map((_, bearerIndex) => {
          const bearerDepth = 75 * scale
          const totalBearerDepth = bearerDepth * quoteData.numberOfBearers
          const availableSpace = palletDepth - totalBearerDepth
          const numberOfGaps = quoteData.numberOfBearers - 1
          const gapSize = numberOfGaps > 0 ? availableSpace / numberOfGaps : 0
          
          const bearerZPos = bearerIndex === 0
            ? -palletDepth / 2 + bearerDepth / 2
            : -palletDepth / 2 + bearerDepth / 2 + (bearerIndex * (bearerDepth + gapSize))
          
          const nailYPos = -bearerHeight / 2 - boardThickness / 2
          const nailOffset = boardWidth * 0.15
          
          return (
            <React.Fragment key={`bottom-nail-${boardIndex}-${bearerIndex}`}>
              <Nail position={[boardXPos - nailOffset, nailYPos, bearerZPos]} />
              <Nail position={[boardXPos + nailOffset, nailYPos, bearerZPos]} />
            </React.Fragment>
          )
        })
      })}
      
      {/* Dimension Lines */}
      {/* Pallet Width Dimension */}
      <DimensionLine
        start={[-palletWidth / 2, bearerHeight / 2 + 0.5, -palletDepth / 2]}
        end={[palletWidth / 2, bearerHeight / 2 + 0.5, -palletDepth / 2]}
        label={`${quoteData.palletWidth}mm`}
        offset={-0.5}
        axis="x"
      />
      
      {/* Pallet Length Dimension */}
      <DimensionLine
        start={[palletWidth / 2, bearerHeight / 2 + 0.5, -palletDepth / 2]}
        end={[palletWidth / 2, bearerHeight / 2 + 0.5, palletDepth / 2]}
        label={`${quoteData.palletLength}mm`}
        offset={0.5}
        axis="z"
      />
      
      {/* Top Board Gap Dimension (if more than 1 board) */}
      {quoteData.numberOfTopBoards > 1 && (
        <DimensionLine
          start={[-palletWidth / 2 + boardWidth, bearerHeight / 2 + 0.5, palletDepth / 2]}
          end={[-palletWidth / 2 + boardWidth + topGap, bearerHeight / 2 + 0.5, palletDepth / 2]}
          label={`${quoteData.topGapSize.toFixed(1)}mm gap`}
          offset={0.8}
          axis="x"
          color="#10b981"
        />
      )}
      
      {/* Bottom Board Gap Dimension (if more than 1 board) */}
      {quoteData.numberOfBottomBoards > 1 && (
        <DimensionLine
          start={[-palletWidth / 2 + boardWidth, -bearerHeight / 2 - 0.5, palletDepth / 2]}
          end={[-palletWidth / 2 + boardWidth + bottomGap, -bearerHeight / 2 - 0.5, palletDepth / 2]}
          label={`${quoteData.bottomGapSize.toFixed(1)}mm gap`}
          offset={0.8}
          axis="x"
          color="#f59e0b"
        />
      )}
    </group>
  )
}

// Main 3D Pallet Component
function Pallet3D({ quoteData }) {
  if (!quoteData) return null

  return (
    <div className="pallet-3d-container">
      <h3>Interactive 3D Pallet Model</h3>
      <div className="canvas-wrapper">
        <Canvas
          camera={{ position: [15, 10, 15], fov: 50 }}
          shadows
        >
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight position={[-10, 10, -10]} intensity={0.5} />
          
          {/* Pallet */}
          <PalletStructure quoteData={quoteData} />
          
          {/* Ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} receiveShadow>
            <planeGeometry args={[50, 50]} />
            <shadowMaterial opacity={0.3} />
          </mesh>
          
          {/* Controls */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            autoRotate={false}
          />
        </Canvas>
      </div>
      
      <div className="controls-info">
        <p>🖱️ <strong>Click and drag</strong> to rotate 360° • <strong>Scroll</strong> to zoom • <strong>Right-click drag</strong> to pan • Rotate to see underneath!</p>
      </div>
    </div>
  )
}

export default Pallet3D

