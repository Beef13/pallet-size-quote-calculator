/* The phone in "Quote from anywhere, anytime", as a real 3D model.
   It spins up into view when the section arrives and comes to rest at an angle,
   showing the calculator on its screen.

   Model: "iPhone 17 Pro" by Ranguel (sketchfab.com/Ranguel), CC BY 4.0. Its
   wallpaper is not used; textures were reduced in size. */
import {
  ACESFilmicToneMapping, AmbientLight, Box3, ClampToEdgeWrapping, DirectionalLight, DoubleSide, Group,
  Matrix4, MeshBasicMaterial, PerspectiveCamera, PMREMGenerator, Scene, SRGBColorSpace,
  TextureLoader, Vector3, WebGLRenderer
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import modelUrl from './img/phone.glb?url'
import screenLight from './img/app-phone-light.webp'
import screenDark from './img/app-phone-dark.webp'

// Where the display sits within the model's screen picture (measured from the model)
const SCREEN_UV = { u0: 0.048, u1: 0.952, v0: 0.022, v1: 0.977 }
// Where it comes to rest: turned a little to one side, leaning back slightly
// tipped over to the left, turned so its left edge shows, leaning back a little:
// the way a phone sits when held up in the right hand
const REST = { yaw: 0.5, pitch: -0.2, roll: 0.4 }
const SPIN = Math.PI * 3
const DURATION = 2000

export async function mountPhone({ stage, dark }) {
  const canvas = document.createElement('canvas')
  canvas.className = 'phone-canvas'
  canvas.setAttribute('aria-hidden', 'true')

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = ACESFilmicToneMapping

  const scene = new Scene()
  scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
  scene.add(new AmbientLight(0xffffff, 0.4))
  const key = new DirectionalLight(0xffffff, 1.5)
  key.position.set(-3, 5, 6)
  scene.add(key)

  const loader = new TextureLoader()
  const loadScreen = (url) => new Promise((resolve, reject) => loader.load(url, (t) => {
    t.colorSpace = SRGBColorSpace
    t.flipY = false
    t.wrapS = t.wrapT = ClampToEdgeWrapping
    t.anisotropy = renderer.capabilities.getMaxAnisotropy()
    // Stretch the picture so it fills exactly the display's part of the model's mapping
    const w = SCREEN_UV.u1 - SCREEN_UV.u0
    const h = SCREEN_UV.v1 - SCREEN_UV.v0
    // (the model's mapping runs right to left across the display, hence the reversal)
    t.repeat.set(-1 / w, 1 / h)
    t.offset.set(SCREEN_UV.u1 / w, -SCREEN_UV.v0 / h)
    resolve(t)
  }, undefined, reject))

  const [gltf, lightTex, darkTex] = await Promise.all([
    new GLTFLoader().loadAsync(modelUrl), loadScreen(screenLight), loadScreen(screenDark)
  ])

  const model = gltf.scene
  model.updateMatrixWorld(true)
  const screenMat = new MeshBasicMaterial({ map: dark ? darkTex : lightTex, toneMapped: false, side: DoubleSide })
  let display = null
  let lens = null
  model.traverse((node) => {
    if (!node.isMesh) return
    const name = node.material.name
    if (name === 'OLED') { node.material = screenMat; display = node; return }
    if (name === 'Camera_Lens') lens = node
    // The cover glass is left out so the display is seen plainly; other see-through
    // parts are drawn as ordinary glass, which is far cheaper
    if (name === 'Glass') { node.visible = false; return }
    if ('transmission' in node.material) node.material.transmission = 0
    node.material.envMapIntensity = 1.15
  })

  // Stand the model up facing the viewer, whatever way round the file has it:
  // the display marks the front and the cameras mark the top
  const whole = new Box3().setFromObject(model)
  const centre = whole.getCenter(new Vector3())
  const size = whole.getSize(new Vector3())
  const axes = ['x', 'y', 'z']
  const thin = axes.reduce((a, b) => (size[a] < size[b] ? a : b))
  const long = axes.reduce((a, b) => (size[a] > size[b] ? a : b))
  const front = new Vector3()
  front[thin] = Math.sign(new Box3().setFromObject(display).getCenter(new Vector3())[thin] - centre[thin]) || 1
  const up = new Vector3()
  up[long] = Math.sign(new Box3().setFromObject(lens).getCenter(new Vector3())[long] - centre[long]) || 1
  const right = new Vector3().crossVectors(up, front)
  const upright = new Matrix4().makeBasis(right, up, front).invert()

  const fitted = new Group()
  model.position.sub(centre)
  fitted.add(model)
  fitted.applyMatrix4(upright)
  fitted.scale.multiplyScalar(2 / size[long])
  const phone = new Group()
  // Spun about its own long axis first, then leant back, then tipped in the picture
  phone.rotation.order = 'ZXY'
  phone.add(fitted)
  scene.add(phone)

  const camera = new PerspectiveCamera(22, 1, 0.1, 50)
  camera.position.set(0, 0, 6.9)

  let queued = false
  const draw = () => { queued = false; renderer.render(scene, camera) }
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(draw) } }

  // 0: out of sight below, small, turned away. 1: at rest.
  const pose = (t) => {
    const e = 1 - Math.pow(1 - t, 3)
    phone.rotation.set(REST.pitch * e, REST.yaw - (1 - e) * SPIN, REST.roll * e)
    phone.position.y = (1 - e) * -1.5
    phone.scale.setScalar(0.55 + 0.45 * e)
    canvas.style.opacity = String(Math.min(1, t * 4))
    ask()
  }

  const resize = () => {
    const w = stage.clientWidth
    const h = stage.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    ask()
  }

  stage.append(canvas)
  resize()
  pose(0)

  let played = false
  return {
    resize,
    play: () => {
      if (played) return
      played = true
      const began = performance.now()
      const step = (now) => {
        const t = Math.min(1, (now - began) / DURATION)
        pose(t)
        if (t < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    },
    setDark: (on) => { screenMat.map = on ? darkTex : lightTex; screenMat.needsUpdate = true; ask() }
  }
}
