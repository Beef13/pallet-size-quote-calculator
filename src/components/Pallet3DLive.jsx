import React, { useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Line, Billboard } from '@react-three/drei'
import '../styles/Pallet3DLive.css'

// Dimension Line Component - technical drawing style like reference image
function DimensionLine({ start, end, offset = 0.5, label, color = '#555555', direction = 'horizontal' }) {
  const lineWidth = 1
  const arrowSize = 0.12
  
  // Calculate dimension line positions based on direction
  const isHorizontal = direction === 'horizontal'
  const isVertical = direction === 'vertical'
  const isDepth = direction === 'depth'
  
  let extStart1, extEnd1, extStart2, extEnd2, dimStart, dimEnd, textPos
  
  if (isHorizontal) {
    // X-axis dimension (width) - extends in Y direction
    const offsetDir = offset > 0 ? 1 : -1
    extStart1 = [start[0], start[1], start[2]]
    extEnd1 = [start[0], start[1] + offset * 1.2, start[2]]
    extStart2 = [end[0], end[1], end[2]]
    extEnd2 = [end[0], end[1] + offset * 1.2, end[2]]
    dimStart = [start[0], start[1] + offset, start[2]]
    dimEnd = [end[0], end[1] + offset, end[2]]
    textPos = [(start[0] + end[0]) / 2, start[1] + offset + (offsetDir * 0.35), start[2]]
  } else if (isVertical) {
    // Y-axis dimension (height) - extends in X direction
    extStart1 = [start[0], start[1], start[2]]
    extEnd1 = [start[0] + offset * 1.2, start[1], start[2]]
    extStart2 = [end[0], end[1], end[2]]
    extEnd2 = [end[0] + offset * 1.2, end[1], end[2]]
    dimStart = [start[0] + offset, start[1], start[2]]
    dimEnd = [end[0] + offset, end[1], end[2]]
    textPos = [start[0] + offset + 0.5, (start[1] + end[1]) / 2, start[2]]
  } else {
    // Z-axis dimension (depth/length) - extends in X direction
    const offsetDir = offset > 0 ? 1 : -1
    extStart1 = [start[0], start[1], start[2]]
    extEnd1 = [start[0] + offset * 1.2, start[1], start[2]]
    extStart2 = [end[0], end[1], end[2]]
    extEnd2 = [end[0] + offset * 1.2, end[1], end[2]]
    dimStart = [start[0] + offset, start[1], start[2]]
    dimEnd = [end[0] + offset, end[1], end[2]]
    textPos = [start[0] + offset + (offsetDir * 0.5), start[1], (start[2] + end[2]) / 2]
  }
  
  // Arrow points calculation
  const getArrowPoints = (point, towardEnd) => {
    const dir = towardEnd ? 1 : -1
    if (isHorizontal) {
      return [
        [[point[0] + dir * arrowSize, point[1] + arrowSize * 0.6, point[2]], point],
        [[point[0] + dir * arrowSize, point[1] - arrowSize * 0.6, point[2]], point]
      ]
    } else if (isVertical) {
      return [
        [[point[0] + arrowSize * 0.6, point[1] + dir * arrowSize, point[2]], point],
        [[point[0] - arrowSize * 0.6, point[1] + dir * arrowSize, point[2]], point]
      ]
    } else {
      return [
        [[point[0] + arrowSize * 0.6, point[1], point[2] + dir * arrowSize], point],
        [[point[0] - arrowSize * 0.6, point[1], point[2] + dir * arrowSize], point]
      ]
    }
  }
  
  const arrow1 = getArrowPoints(dimStart, true)
  const arrow2 = getArrowPoints(dimEnd, false)
  
  return (
    <group>
      {/* Extension line 1 */}
      <Line points={[extStart1, extEnd1]} color={color} lineWidth={lineWidth} />
      
      {/* Extension line 2 */}
      <Line points={[extStart2, extEnd2]} color={color} lineWidth={lineWidth} />
      
      {/* Dimension line */}
      <Line points={[dimStart, dimEnd]} color={color} lineWidth={lineWidth} />
      
      {/* Arrow head at start */}
      <Line points={arrow1[0]} color={color} lineWidth={lineWidth} />
      <Line points={arrow1[1]} color={color} lineWidth={lineWidth} />
      
      {/* Arrow head at end */}
      <Line points={arrow2[0]} color={color} lineWidth={lineWidth} />
      <Line points={arrow2[1]} color={color} lineWidth={lineWidth} />
      
      {/* Label - always faces viewer */}
      <Billboard position={textPos} follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          fontSize={0.4}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#ffffff"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

// Single board component with wood-like appearance
function Board({ position, size, color = '#d4a574' }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.7} 
        metalness={0.05}
      />
    </mesh>
  )
}

// Nail component
function Nail({ position }) {
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
      <meshStandardMaterial 
        color="#333333" 
        metalness={0.9} 
        roughness={0.3}
      />
    </mesh>
  )
}

// Progressive Pallet Structure - builds item by item
function PalletStructure({ previewData }) {
  const groupRef = useRef()
  
  // Scale: 1mm = 0.01 units
  const scale = 0.01
  
  const palletWidth = previewData.palletWidth * scale
  const palletDepth = previewData.palletLength * scale
  
  // Separate board dimensions for top and bottom
  const topBoardWidth = (previewData.topBoardWidth || 100) * scale
  const topBoardThickness = (previewData.topBoardThickness || 22) * scale
  const topLeaderWidth = (previewData.topLeaderWidth || previewData.topBoardWidth || 100) * scale
  const topLeaderThickness = (previewData.topLeaderThickness || previewData.topBoardThickness || 22) * scale
  const useCustomTopLeaders = previewData.useCustomTopLeaders || false
  
  const bottomBoardWidth = (previewData.bottomBoardWidth || 100) * scale
  const bottomBoardThickness = (previewData.bottomBoardThickness || 22) * scale
  const bottomLeaderWidth = (previewData.bottomLeaderWidth || previewData.bottomBoardWidth || 100) * scale
  const bottomLeaderThickness = (previewData.bottomLeaderThickness || previewData.bottomBoardThickness || 22) * scale
  const useCustomBottomLeaders = previewData.useCustomBottomLeaders || false
  
  // Bearer stands on its short side (thickness), with the width as vertical height
  const bearerStandingHeight = (previewData.bearerWidth || 75) * scale  // Vertical height (75mm stands tall)
  const bearerDepth = (previewData.bearerHeight || 38) * scale          // Front-to-back depth (38mm is the base)
  
  const topGap = previewData.topGapSize * scale
  const bottomGap = previewData.bottomGapSize * scale

  // Memoize board positions and widths for top boards (accounting for custom leaders)
  const topBoardData = useMemo(() => {
    const numBoards = previewData.numberOfTopBoards
    if (numBoards === 0) return []
    
    const data = []
    let currentX = -palletWidth / 2
    
    for (let i = 0; i < numBoards; i++) {
      const isEdge = i === 0 || i === numBoards - 1
      const boardW = (useCustomTopLeaders && isEdge) ? topLeaderWidth : topBoardWidth
      const boardT = (useCustomTopLeaders && isEdge) ? topLeaderThickness : topBoardThickness
      
      const xPos = currentX + boardW / 2
      data.push({ xPos, width: boardW, thickness: boardT, isLeader: useCustomTopLeaders && isEdge })
      
      currentX += boardW + topGap
    }
    return data
  }, [previewData.numberOfTopBoards, palletWidth, topBoardWidth, topBoardThickness, topLeaderWidth, topLeaderThickness, topGap, useCustomTopLeaders])

  // Memoize board positions and widths for bottom boards (accounting for custom leaders)
  const bottomBoardData = useMemo(() => {
    const numBoards = previewData.numberOfBottomBoards
    if (numBoards === 0) return []
    
    const data = []
    let currentX = -palletWidth / 2
    
    for (let i = 0; i < numBoards; i++) {
      const isEdge = i === 0 || i === numBoards - 1
      const boardW = (useCustomBottomLeaders && isEdge) ? bottomLeaderWidth : bottomBoardWidth
      const boardT = (useCustomBottomLeaders && isEdge) ? bottomLeaderThickness : bottomBoardThickness
      
      const xPos = currentX + boardW / 2
      data.push({ xPos, width: boardW, thickness: boardT, isLeader: useCustomBottomLeaders && isEdge })
      
      currentX += boardW + bottomGap
    }
    return data
  }, [previewData.numberOfBottomBoards, palletWidth, bottomBoardWidth, bottomBoardThickness, bottomLeaderWidth, bottomLeaderThickness, bottomGap, useCustomBottomLeaders])

  const bearerPositions = useMemo(() => {
    const totalBearerDepth = bearerDepth * previewData.numberOfBearers
    const availableSpace = palletDepth - totalBearerDepth
    const gapCount = previewData.numberOfBearers - 1
    const gapSize = gapCount > 0 ? availableSpace / gapCount : 0
    
    return Array.from({ length: previewData.numberOfBearers }).map((_, i) => {
      return i === 0
        ? -palletDepth / 2 + bearerDepth / 2
        : -palletDepth / 2 + bearerDepth / 2 + (i * (bearerDepth + gapSize))
    })
  }, [previewData.numberOfBearers, palletDepth, bearerDepth])

  const hasComponents = previewData.numberOfTopBoards > 0 || 
                       previewData.numberOfBottomBoards > 0 || 
                       previewData.numberOfBearers > 0

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Top Boards - Light wood color, leaders are slightly different shade */}
      {topBoardData.map((board, index) => (
        <Board
          key={`top-${index}`}
          position={[board.xPos, bearerStandingHeight / 2 + board.thickness / 2, 0]}
          size={[board.width, board.thickness, palletDepth]}
          color={board.isLeader ? "#d4c4a7" : "#e8d5b7"}
        />
      ))}
      
      {/* Bearers (Stringers) - Standing on short side, darker wood color */}
      {bearerPositions.map((zPos, index) => (
        <Board
          key={`bearer-${index}`}
          position={[0, 0, zPos]}
          size={[palletWidth, bearerStandingHeight, bearerDepth]}
          color="#c9a66b"
        />
      ))}
      
      {/* Bottom Boards - Medium wood color, leaders are slightly different shade */}
      {bottomBoardData.map((board, index) => (
        <Board
          key={`bottom-${index}`}
          position={[board.xPos, -bearerStandingHeight / 2 - board.thickness / 2, 0]}
          size={[board.width, board.thickness, palletDepth]}
          color={board.isLeader ? "#c4a886" : "#d4b896"}
        />
      ))}
      
      {/* Nails for top boards - positioned so nail head sticks up 0.03 units above board */}
      {topBoardData.map((board, boardIdx) => 
        bearerPositions.map((bearerZ, bearerIdx) => {
          const boardTopSurface = bearerStandingHeight / 2 + board.thickness
          const nailHeight = 0.2
          const stickUpAmount = 0.03  // Amount nail sticks up above board
          const nailY = boardTopSurface - (nailHeight / 2) + stickUpAmount
          const nailOffset = board.width * 0.2
          return (
            <React.Fragment key={`top-nail-${boardIdx}-${bearerIdx}`}>
              <Nail position={[board.xPos - nailOffset, nailY, bearerZ]} />
              <Nail position={[board.xPos + nailOffset, nailY, bearerZ]} />
            </React.Fragment>
          )
        })
      )}
      
      {/* Nails for bottom boards - positioned so nail point sticks down 0.03 units below board */}
      {bottomBoardData.map((board, boardIdx) => 
        bearerPositions.map((bearerZ, bearerIdx) => {
          const boardBottomSurface = -bearerStandingHeight / 2 - board.thickness
          const nailHeight = 0.2
          const stickDownAmount = 0.03  // Amount nail sticks down below board
          const nailY = boardBottomSurface + (nailHeight / 2) - stickDownAmount
          const nailOffset = board.width * 0.2
          return (
            <React.Fragment key={`bottom-nail-${boardIdx}-${bearerIdx}`}>
              <Nail position={[board.xPos - nailOffset, nailY, bearerZ]} />
              <Nail position={[board.xPos + nailOffset, nailY, bearerZ]} />
            </React.Fragment>
          )
        })
      )}

      {/* Ghost outline when no components */}
      {!hasComponents && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[palletWidth, bearerStandingHeight + topBoardThickness + bottomBoardThickness, palletDepth]} />
          <meshStandardMaterial 
            color="#999999" 
            transparent 
            opacity={0.15}
            wireframe
          />
        </mesh>
      )}

      {/* Dimension Lines - technical drawing style like reference image */}
      {palletWidth > 0 && palletDepth > 0 && hasComponents && (
        <>
          {/* Width dimension - top back edge */}
          <DimensionLine
            start={[-palletWidth / 2, bearerStandingHeight / 2 + topBoardThickness, -palletDepth / 2]}
            end={[palletWidth / 2, bearerStandingHeight / 2 + topBoardThickness, -palletDepth / 2]}
            offset={1.8}
            label={`${Math.round(previewData.palletWidth)}mm`}
            direction="horizontal"
          />
          
          {/* Length dimension - right side */}
          <DimensionLine
            start={[palletWidth / 2, bearerStandingHeight / 2 + topBoardThickness, -palletDepth / 2]}
            end={[palletWidth / 2, bearerStandingHeight / 2 + topBoardThickness, palletDepth / 2]}
            offset={1.8}
            label={`${Math.round(previewData.palletLength)}mm`}
            direction="depth"
          />
          
          {/* Height dimension - left back corner (opposite end of width dimension) */}
          <DimensionLine
            start={[-palletWidth / 2, -bearerStandingHeight / 2 - bottomBoardThickness, -palletDepth / 2]}
            end={[-palletWidth / 2, bearerStandingHeight / 2 + topBoardThickness, -palletDepth / 2]}
            offset={-1.8}
            label={`${Math.round((previewData.bearerWidth || 75) + (previewData.topBoardThickness || 22) + (previewData.bottomBoardThickness || 22))}mm`}
            direction="vertical"
          />
          
          {/* Gap dimension between first two top boards (if gap exists) */}
          {previewData.numberOfTopBoards >= 2 && topGap > 0.001 && topBoardData.length >= 2 && (
            <DimensionLine
              start={[topBoardData[0].xPos + topBoardData[0].width / 2, bearerStandingHeight / 2 + topBoardData[0].thickness, palletDepth / 2]}
              end={[topBoardData[1].xPos - topBoardData[1].width / 2, bearerStandingHeight / 2 + topBoardData[1].thickness, palletDepth / 2]}
              offset={3.0}
              label={`${Math.round(previewData.topGapSize)}mm top gap`}
              direction="horizontal"
            />
          )}
          
          {/* Gap dimension between first two bottom boards (if gap exists) */}
          {previewData.numberOfBottomBoards >= 2 && bottomGap > 0.001 && bottomBoardData.length >= 2 && (
            <DimensionLine
              start={[bottomBoardData[0].xPos + bottomBoardData[0].width / 2, -bearerStandingHeight / 2 - bottomBoardData[0].thickness, palletDepth / 2]}
              end={[bottomBoardData[1].xPos - bottomBoardData[1].width / 2, -bearerStandingHeight / 2 - bottomBoardData[1].thickness, palletDepth / 2]}
              offset={-2.5}
              label={`${Math.round(previewData.bottomGapSize)}mm btm gap`}
              direction="horizontal"
            />
          )}
        </>
      )}
    </group>
  )
}

// Main Live 3D Component
function Pallet3DLive({ previewData }) {
  return (
    <div className="pallet-3d-live">
      <Canvas
        camera={{ position: [14, 10, 14], fov: 40 }}
        shadows
        dpr={[1, 2]}
      >
        {/* Ambient lighting */}
        <ambientLight intensity={0.6} />
        
        {/* Main directional light */}
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        
        {/* Fill light */}
        <directionalLight
          position={[-5, 5, -5]}
          intensity={0.3}
        />
        
        {/* Rim light */}
        <pointLight position={[0, 10, -15]} intensity={0.4} />
        
        {/* Pallet */}
        <PalletStructure previewData={previewData} />
        
        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          autoRotate={false}
          minDistance={5}
          maxDistance={50}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  )
}

export default Pallet3DLive
