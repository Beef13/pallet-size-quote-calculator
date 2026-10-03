/* The laptop in the hero, as a real 3D model.
   It starts shut, seen from above; scrolling opens the lid and brings the eye round
   to the front, square to the screen, where the working calculator takes over from
   the picture on the model's display.

   Model: "MacBook Pro 16" 2021" by rtql8d (sketchfab.com/rtql8d), CC BY 4.0.
   Its lid logo and wallpaper are not used. */
import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, DirectionalLight, Group, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator,
  Scene, Shape, ShapeGeometry, SRGBColorSpace, TextureLoader, Vector3, WebGLRenderer
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import modelUrl from './img/laptop.glb?url'
import screenLight from './img/app-desktop-light.webp'
import screenDark from './img/app-desktop-dark.webp'

// Measurements taken from the model, in its own units (x across, y front to back, z up)
// The hinge line is inside the back of the base. Turning the lid about it brings the
// lid's face down flat on the deck with its front edge level with the base's.
const HINGE = { y: 1.205, z: -0.057 }
const DISPLAY = { halfWidth: 1.742, bottom: 0.15, top: 2.352, y: 1.2619 }
// Radius of the display's top corners, as a share of its width
export const CORNER = 0.0165
const LID_PARTS = ['Aluminum_-_Satin', 'Glass_Clear', 'Steel_-_Satin', 'Steel_-_Satin_NONE']

const clamp = (v) => Math.max(0, Math.min(1, v))
const smooth = (t) => t * t * (3 - 2 * t)
const part = (p, from, to) => clamp((p - from) / (to - from))

export async function mountLaptop({ stage, dark }) {
  const canvas = document.createElement('canvas')
  canvas.className = 'laptop-canvas'
  canvas.setAttribute('aria-hidden', 'true')

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.add(new AmbientLight(0xffffff, 0.35))
  const key = new DirectionalLight(0xffffff, 1.6)
  key.position.set(-4, 7, 5)
  scene.add(key)

  const loader = new TextureLoader()
  const loadTexture = (url) => new Promise((resolve, reject) => loader.load(url, (t) => {
    t.colorSpace = SRGBColorSpace
    t.anisotropy = renderer.capabilities.getMaxAnisotropy()
    resolve(t)
  }, undefined, reject))

  const [gltf, lightTex, darkTex] = await Promise.all([
    new GLTFLoader().loadAsync(modelUrl), loadTexture(screenLight), loadTexture(screenDark)
  ])

  // The model comes as one piece per material. The lid's pieces go into a group that
  // turns on the hinge; everything else is the base.
  const root = gltf.scene
  scene.add(root)
  root.updateMatrixWorld(true)
  const meshes = []
  root.traverse((node) => { if (node.isMesh) meshes.push(node) })
  const body = meshes[0].parent
  const lid = new Group()
  lid.position.set(0, HINGE.y, HINGE.z)
  body.add(lid)
  lid.updateMatrixWorld(true)

  for (const mesh of meshes) {
    const name = mesh.material.name
    if (LID_PARTS.includes(name)) lid.attach(mesh)
    if (name === 'Glass_Clear') mesh.visible = false
    // Plain metal on the lid, with no maker's mark
    if (name === 'Aluminum_-_Satin') {
      mesh.material = new MeshStandardMaterial({ color: 0xd3d6db, metalness: 0.7, roughness: 0.36 })
    }
    // The model's own display picture is switched off; ours goes on a panel in front
    if (name === 'Steel_-_Satin') mesh.material = new MeshBasicMaterial({ color: 0x050608 })
    if (mesh.material.isMeshStandardMaterial) mesh.material.envMapIntensity = 1.1
    // Open, the keyboard deck is seen almost edge-on. Without this its picture is
    // sampled from a much smaller copy and smears sideways.
    if (mesh.material.map) {
      mesh.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy()
      mesh.material.map.needsUpdate = true
    }
  }

  const screenMat = new MeshBasicMaterial({ map: dark ? darkTex : lightTex, toneMapped: false })
  const width = DISPLAY.halfWidth * 2
  const height = DISPLAY.top - DISPLAY.bottom
  // The display's top corners are rounded to sit evenly inside the lid's own corners
  const r = CORNER * width
  const outline = new Shape()
  outline.moveTo(-width / 2, -height / 2)
  outline.lineTo(width / 2, -height / 2)
  outline.lineTo(width / 2, height / 2 - r)
  outline.absarc(width / 2 - r, height / 2 - r, r, 0, Math.PI / 2, false)
  outline.lineTo(-width / 2 + r, height / 2)
  outline.absarc(-width / 2 + r, height / 2 - r, r, Math.PI / 2, Math.PI, false)
  outline.lineTo(-width / 2, -height / 2)
  const panel = new ShapeGeometry(outline, 12)
  const spots = panel.attributes.position
  const uv = panel.attributes.uv
  for (let i = 0; i < spots.count; i++) uv.setXY(i, spots.getX(i) / width + 0.5, spots.getY(i) / height + 0.5)
  const screen = new Mesh(panel, screenMat)
  screen.rotation.x = Math.PI / 2
  screen.position.set(0, DISPLAY.y - HINGE.y, (DISPLAY.top + DISPLAY.bottom) / 2 - HINGE.z)
  lid.add(screen)

  // A soft shadow on the surface under the base, kept inside the laptop's outline so
  // the edge of the drawing never cuts it
  const blot = document.createElement('canvas')
  blot.width = blot.height = 256
  const ctx = blot.getContext('2d')
  const fade = ctx.createRadialGradient(128, 128, 20, 128, 128, 128)
  fade.addColorStop(0, 'rgba(6, 20, 70, 0.42)')
  fade.addColorStop(1, 'rgba(6, 20, 70, 0)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, 256, 256)
  const shadow = new Mesh(
    new PlaneGeometry(3.8, 2.9),
    new MeshBasicMaterial({ map: new CanvasTexture(blot), transparent: true, depthWrite: false, toneMapped: false })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0, -0.16, 0.1)
  scene.add(shadow)

  // In the scene the model stands with y up and its user towards +z
  const screenCentre = new Vector3(0, (DISPLAY.top + DISPLAY.bottom) / 2, -DISPLAY.y)
  const DISTANCE = 26
  const camera = new PerspectiveCamera(7, 1.39, 1, 80)
  // Open: square to the screen, a little below its middle so the base is in the picture
  const aimOpen = screenCentre.clone().add(new Vector3(0, -0.2, 0))
  // Shut: looking down on the lid from in front, so its edge and thickness show
  const aimShut = new Vector3(0, -0.5, 0.1)
  const aim = new Vector3()
  const tip = new Vector3()
  const lift = new Vector3()
  // The highest the lid may reach, where 1 is the top edge of the drawing
  const HEADROOM = 0.94

  let progress = -1
  let queued = false
  const draw = () => { queued = false; renderer.render(scene, camera) }
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(draw) } }

  const pose = (p) => {
    progress = p
    const open = smooth(part(p, 0.08, 0.86))
    const round = smooth(part(p, 0.0, 0.9))
    lid.rotation.x = (1 - open) * Math.PI / 2
    const rise = (1 - round) * 34 * Math.PI / 180
    aim.lerpVectors(aimShut, aimOpen, round)
    camera.position.set(aim.x, aim.y + Math.sin(rise) * DISTANCE, aim.z + Math.cos(rise) * DISTANCE)
    camera.lookAt(aim)
    // Part-way open, the lid can stand taller in the picture than it does at either
    // end. If its top edge would pass the top of the drawing, the whole view is
    // lowered by just that much, so the laptop is never cut off.
    camera.updateMatrixWorld(true)
    lid.updateMatrixWorld(true)
    let peak = -1
    for (const x of [-1.78, 1.78]) {
      for (const y of [1.2639, 1.3]) {
        tip.set(x, y - HINGE.y, 2.4 - HINGE.z)
        peak = Math.max(peak, lid.localToWorld(tip).project(camera).y)
      }
    }
    if (peak > HEADROOM) {
      const halfHeight = Math.tan(camera.fov * Math.PI / 360) * DISTANCE
      lift.set(0, 1, 0).applyQuaternion(camera.quaternion)
      camera.position.addScaledVector(lift, (peak - HEADROOM) * halfHeight)
    }
    // The display is dark until the lid is most of the way up
    const wake = part(p, 0.45, 0.8)
    screenMat.color.setScalar(wake)
    // This shadow is for the view from above. Open, the page draws a wider one under
    // the base, which the edge of the drawing cannot cut off.
    shadow.material.opacity = 1 - round
    ask()
  }

  // Where the display sits on the page once open, as a box inside the stage
  const corner = new Vector3()
  const rect = () => {
    const w = stage.clientWidth
    const h = stage.clientHeight
    const at = (x, z) => {
      corner.set(x, DISPLAY.y - HINGE.y, z - HINGE.z)
      screen.parent.localToWorld(corner).project(camera)
      return [(corner.x + 1) / 2 * w, (1 - corner.y) / 2 * h]
    }
    const [left, top] = at(-DISPLAY.halfWidth, DISPLAY.top)
    const [right, bottom] = at(DISPLAY.halfWidth, DISPLAY.bottom)
    return { left, top, width: right - left, height: bottom - top, radius: (right - left) * CORNER }
  }

  // Where the base meets the surface once open: the bottom front edge, on the page
  const ground = () => {
    const w = stage.clientWidth
    const h = stage.clientHeight
    const at = (x) => {
      corner.set(x, -1.24, -0.135)
      body.localToWorld(corner).project(camera)
      return [(corner.x + 1) / 2 * w, (1 - corner.y) / 2 * h]
    }
    const [left, y] = at(-1.78)
    const [right] = at(1.78)
    return { left, width: right - left, y }
  }

  const resize = () => {
    const w = stage.clientWidth
    const h = stage.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Hold the laptop's width against the stage's, whatever the stage's shape
    const halfHeight = (4.04 / camera.aspect) / 2
    camera.fov = 2 * Math.atan(halfHeight / DISTANCE) * 180 / Math.PI
    camera.updateProjectionMatrix()
    if (progress >= 0) pose(progress)
  }

  stage.prepend(canvas)
  resize()
  pose(0)
  renderer.render(scene, camera)

  return {
    pose,
    resize,
    openRect: () => {
      const was = progress
      pose(1)
      scene.updateMatrixWorld(true)
      camera.updateMatrixWorld(true)
      const box = rect()
      box.ground = ground()
      pose(was)
      return box
    },
    setDark: (on) => { screenMat.map = on ? darkTex : lightTex; screenMat.needsUpdate = true; ask() }
  }
}
