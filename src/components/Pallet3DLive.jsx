import React, { useRef, useMemo, useEffect, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Vector3, Quaternion } from 'three'
import { OrbitControls, Text, Line, Billboard, ContactShadows } from '@react-three/drei'
// Bundled locally so labels work offline (drei's default font is fetched from Google)
import labelFont from '../assets/fonts/outfit-latin-500-normal.woff'
import '../styles/Pallet3DLive.css'

// If the labels ever fail to render, hide them instead of breaking the whole app
class LabelErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('3D dimension labels disabled:', error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

// World axes shown in the corner of the view, CAD style (Z up, as in Rhino).
// The scene itself is Y up, so: X = pallet width, Y = pallet length (into the scene), Z = height.
const AXES = [
  { key: 'x', dir: [1, 0, 0] },
  { key: 'y', dir: [0, 0, -1] },
  { key: 'z', dir: [0, 1, 0] }
]
const AXIS_LENGTH = 26   // px, at full length (axis lying flat to the screen)
const AXIS_LABEL_GAP = 9 // px from the end of the line to its letter

// Runs inside the canvas: turns the corner axes to match the camera on every frame
function AxisTracker({ targetRef }) {
  const scratch = useMemo(() => new Vector3(), [])
  const inverse = useMemo(() => new Quaternion(), [])
  const parts = useRef(null)   // cached SVG nodes, looked up once
  const last = useRef(null)    // camera rotation at the last update
  const order = useRef('')     // current back-to-front drawing order

  useFrame(({ camera }) => {
    const svg = targetRef.current
    if (!svg) return
    if (!parts.current || parts.current.svg !== svg) {
      parts.current = {
        svg,
        axes: AXES.map(({ key, dir }) => ({
          key,
          dir,
          group: svg.querySelector(`[data-axis="${key}"]`),
          line: svg.querySelector(`[data-axis-line="${key}"]`),
          text: svg.querySelector(`[data-axis-label="${key}"]`),
          depth: 0
        }))
      }
      last.current = null
    }

    // Nothing to do unless the camera has turned at all (exact compare, so slow drags are never skipped)
    const q = camera.quaternion
    const prev = last.current
    if (prev && prev.x === q.x && prev.y === q.y && prev.z === q.z && prev.w === q.w) return
    last.current = { x: q.x, y: q.y, z: q.z, w: q.w }

    inverse.copy(q).invert()
    const { axes } = parts.current
    for (const axis of axes) {
      if (!axis.line || !axis.text) continue
      // Axis direction as seen from the camera: x right, y up, z towards the viewer
      scratch.set(axis.dir[0], axis.dir[1], axis.dir[2]).applyQuaternion(inverse)
      const x = scratch.x
      const y = -scratch.y
      axis.depth = scratch.z
      const ex = x * AXIS_LENGTH
      const ey = y * AXIS_LENGTH
      axis.line.setAttribute('x2', ex)
      axis.line.setAttribute('y2', ey)
      // Push the letter out along the axis. As the axis turns to point at the viewer its
      // on-screen direction becomes unstable, so ease the letter towards "straight up" instead.
      const flat = Math.hypot(x, y)
      const t = Math.min(1, flat / 0.45)
      const blend = t * t * (3 - 2 * t)
      let ox = flat > 1e-6 ? (x / flat) * blend : 0
      let oy = flat > 1e-6 ? (y / flat) * blend - (1 - blend) : -1
      const len = Math.hypot(ox, oy) || 1
      ox /= len
      oy /= len
      axis.text.setAttribute('transform', `translate(${ex + ox * AXIS_LABEL_GAP} ${ey + oy * AXIS_LABEL_GAP})`)
    }

    // Draw the nearest axis last so it sits on top. Only touch the DOM when the order
    // really changes, with a small margin so two axes at similar depth don't swap back and forth.
    const current = order.current ? order.current.split('') : axes.map(a => a.key)
    const depthOf = Object.fromEntries(axes.map(a => [a.key, a.depth]))
    const next = [...current]
    for (let pass = 0; pass < next.length; pass++) {
      for (let i = 0; i < next.length - 1; i++) {
        if (depthOf[next[i]] > depthOf[next[i + 1]] + 0.04) {
          const tmp = next[i]; next[i] = next[i + 1]; next[i + 1] = tmp
        }
      }
    }
    const nextOrder = next.join('')
    if (nextOrder !== order.current) {
      order.current = nextOrder
      next.forEach(key => {
        const axis = axes.find(a => a.key === key)
        if (axis?.group) svg.appendChild(axis.group)
      })
    }
  })
  return null
}

function AxisIndicator({ svgRef }) {
  return (
    <svg ref={svgRef} className="axis-indicator" viewBox="-44 -44 88 88" width="88" height="88" role="img" aria-label="X, Y and Z axis directions">
      {AXES.map(({ key }) => (
        <g key={key} data-axis={key} className={`axis axis-${key}`}>
          <line data-axis-line={key} x1="0" y1="0" x2="0" y2="0" />
          <text data-axis-label={key} x="0" y="0" textAnchor="middle" dominantBaseline="central">{key}</text>
        </g>
      ))}
    </svg>
  )
}

// Keep the whole pallet in view when its size changes (keeps the user's viewing angle)
function CameraFit({ width, length, height }) {
  const { camera, controls, size: viewport } = useThree()
  const size = Math.max(width, length, height, 4)
  // Tall, narrow views (phones) need the camera further back to fit the width
  const aspect = viewport.width / Math.max(1, viewport.height)
  const narrowFactor = aspect < 1.2 ? 1.2 / aspect : 1
  useEffect(() => {
    const distance = size * 2.8 * narrowFactor
    const dir = camera.position.clone()
    if (dir.lengthSq() < 1e-6) dir.set(14, 10, 14)
    dir.normalize().multiplyScalar(distance)
    camera.position.copy(dir)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, 0, 0)
      controls.update()
    }
  }, [size, narrowFactor, camera, controls])
  return null
}

// Dimension Line Component - technical drawing style like reference image
function DimensionLine({ start, end, offset = 0.5, label, color = '#3d4852', textColor = '#1e2833', outlineColor = '#e4e6e7', direction = 'horizontal' }) {
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
          font={labelFont}
          fontSize={0.4}
          color={textColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor={outlineColor}
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
function PalletStructure({ previewData, dark = false }) {
  // Dimension line colours follow the light/dark theme
  const dim = dark
    ? { color: '#8b959c', textColor: '#e3e6e1', outlineColor: '#17191b' }
    : { color: '#a1a5ab', textColor: '#3f444a', outlineColor: '#f4f4f5' }

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
      {!hasComponents && palletWidth > 0 && palletDepth > 0 && (
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

      {/* Dimension Lines - only show when relevant components are selected */}
      {/* Suspense keeps the pallet visible while the label font loads */}
      <LabelErrorBoundary>
      <Suspense fallback={null}>
      
      {/* Width dimension - shows when pallet width is set AND there are any boards or bearers */}
      {palletWidth > 0 && palletDepth > 0 && hasComponents && (
        <DimensionLine
          {...dim}
          start={[-palletWidth / 2, bearerStandingHeight / 2 + topBoardThickness, -palletDepth / 2]}
          end={[palletWidth / 2, bearerStandingHeight / 2 + topBoardThickness, -palletDepth / 2]}
          offset={1.8}
          label={`${Math.round(previewData.palletWidth)}mm`}
          direction="horizontal"
        />
      )}
      
      {/* Length dimension - shows when pallet length is set AND there are any boards or bearers */}
      {palletWidth > 0 && palletDepth > 0 && hasComponents && (
        <DimensionLine
          {...dim}
          start={[palletWidth / 2, bearerStandingHeight / 2 + topBoardThickness, -palletDepth / 2]}
          end={[palletWidth / 2, bearerStandingHeight / 2 + topBoardThickness, palletDepth / 2]}
          offset={1.8}
          label={`${Math.round(previewData.palletLength)}mm`}
          direction="depth"
        />
      )}
      
      {/* Height dimension - ONLY shows when ALL components are selected (top boards, bearers, AND bottom boards) */}
      {palletWidth > 0 && palletDepth > 0 && 
       previewData.numberOfTopBoards > 0 && 
       previewData.numberOfBearers > 0 && 
       previewData.numberOfBottomBoards > 0 && (
        <DimensionLine
          {...dim}
          start={[-palletWidth / 2, -bearerStandingHeight / 2 - bottomBoardThickness, -palletDepth / 2]}
          end={[-palletWidth / 2, bearerStandingHeight / 2 + topBoardThickness, -palletDepth / 2]}
          offset={-1.8}
          label={`${Math.round((previewData.bearerWidth || 75) + (previewData.topBoardThickness || 22) + (previewData.bottomBoardThickness || 22))}mm`}
          direction="vertical"
        />
      )}
      
      {/* Top gap dimension - shows only when 2+ top boards exist */}
      {previewData.numberOfTopBoards >= 2 && topGap > 0.001 && topBoardData.length >= 2 && (
        <DimensionLine
          {...dim}
          start={[topBoardData[0].xPos + topBoardData[0].width / 2, bearerStandingHeight / 2 + topBoardData[0].thickness, palletDepth / 2]}
          end={[topBoardData[1].xPos - topBoardData[1].width / 2, bearerStandingHeight / 2 + topBoardData[1].thickness, palletDepth / 2]}
          offset={3.0}
          label={`${Math.round(previewData.topGapSize)}mm top gap`}
          direction="horizontal"
        />
      )}
      
      {/* Bottom gap dimension - shows only when 2+ bottom boards exist */}
      {previewData.numberOfBottomBoards >= 2 && bottomGap > 0.001 && bottomBoardData.length >= 2 && (
        <DimensionLine
          {...dim}
          start={[bottomBoardData[0].xPos + bottomBoardData[0].width / 2, -bearerStandingHeight / 2 - bottomBoardData[0].thickness, palletDepth / 2]}
          end={[bottomBoardData[1].xPos - bottomBoardData[1].width / 2, -bearerStandingHeight / 2 - bottomBoardData[1].thickness, palletDepth / 2]}
          offset={-2.5}
          label={`${Math.round(previewData.bottomGapSize)}mm btm gap`}
          direction="horizontal"
        />
      )}
      </Suspense>
      </LabelErrorBoundary>
    </group>
  )
}

// Main Live 3D Component
function Pallet3DLive({ previewData, dark = false }) {
  const axisRef = useRef(null)
  return (
    <div className="pallet-3d-live">
      <AxisIndicator svgRef={axisRef} />
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
        <PalletStructure previewData={previewData} dark={dark} />

        {/* Soft shadow on the ground under the pallet */}
        <ContactShadows
          position={[0, -((previewData.bearerWidth || 75) / 2 + (previewData.bottomBoardThickness || 22) + 1) * 0.01, 0]}
          scale={Math.max(previewData.palletWidth || 0, previewData.palletLength || 0, 600) * 0.01 * 1.6}
          opacity={dark ? 0.6 : 0.35}
          blur={2.4}
          far={4}
          resolution={256}
          color={dark ? '#000000' : '#26313a'}
        />

        <AxisTracker targetRef={axisRef} />

        <CameraFit
          width={(previewData.palletWidth || 0) * 0.01}
          length={(previewData.palletLength || 0) * 0.01}
          height={((previewData.bearerWidth || 75) + (previewData.topBoardThickness || 22) + (previewData.bottomBoardThickness || 22)) * 0.01}
        />
        
        {/* Controls */}
        <OrbitControls
          makeDefault
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          autoRotate={false}
          minDistance={5}
          maxDistance={150}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  )
}

export default Pallet3DLive
