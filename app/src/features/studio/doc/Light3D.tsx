// The 3D light preview (FLOWS §18, advanced light): a stand-in bottle (a cylinder and its cap) on a surface, lit by
// the rig's lights as spot lights with their own warmth (Kelvin → RGB) and strength. Drag to orbit. Calm and neutral:
// no glow, no bloom, one soft shadow, drawn only when something changes. Loaded lazily (React.lazy) so three.js
// stays out of the main bundle; the board's square takes it in its preview slot.
import { kelvinToRgb, type StudioLightRig } from "@fume/ui";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  rig: THREE.Group;
  draw: () => void;
}

/** A token's colour from the page (the preview sits on the panel's sunken ground). */
const tokenColour = (el: Element, name: string, fallback: string) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  try {
    return new THREE.Color(v || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
};

/** A board position (seen from above, camera at the foot) and height in degrees, as a place in the scene. */
function place(x: number, y: number, height: number) {
  const r = 2.4;
  const az = Math.atan2(x - 0.5, y - 0.5);
  const reach = Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 2) * 0.6 + 0.4;
  const el = (height * Math.PI) / 180;
  return new THREE.Vector3(
    Math.sin(az) * r * reach * Math.cos(el),
    0.7 + r * Math.sin(el),
    Math.cos(az) * r * reach * Math.cos(el),
  );
}

export default function Light3D({
  rig,
  selected,
  label = "The lights around a stand-in of the product, in 3D. Drag to turn it.",
}: {
  rig: StudioLightRig;
  selected?: string;
  label?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const three = useRef<Scene3D>();

  // Build the scene once.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    } catch {
      el.dataset.failed = "";
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    el.appendChild(renderer.domElement);

    const ground = tokenColour(el, "--ui-surface-sunken", "#ECEAE6");
    const scene = new THREE.Scene();
    scene.background = ground;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 2.2, 6.4);

    // The surface, the bottle and its cap: neutral, a little sheen on the glass.
    const surface = new THREE.Mesh(
      new THREE.CircleGeometry(4, 64),
      new THREE.MeshStandardMaterial({ color: ground.clone().multiplyScalar(0.96), roughness: 0.95 }),
    );
    surface.rotation.x = -Math.PI / 2;
    surface.receiveShadow = true;
    scene.add(surface);
    const glass = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#D9D2C7"),
      roughness: 0.35,
      metalness: 0.05,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.25, 48), glass);
    body.position.y = 0.625;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 0.22, 48), glass);
    shoulder.position.y = 1.36;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.34, 32),
      new THREE.MeshStandardMaterial({ color: new THREE.Color("#4A2A2A"), roughness: 0.7 }),
    );
    cap.position.y = 1.64;
    for (const m of [body, shoulder, cap]) {
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
    scene.add(new THREE.HemisphereLight(0xffffff, ground.getHex(), 0.7));
    const lights = new THREE.Group();
    scene.add(lights);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.8, 0);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.update();

    const draw = () => renderer.render(scene, camera);
    controls.addEventListener("change", draw);
    const size = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || w;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      draw();
    };
    const ro = new ResizeObserver(size);
    ro.observe(el);
    three.current = { renderer, scene, camera, controls, rig: lights, draw };
    size();

    return () => {
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => mt.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      three.current = undefined;
    };
  }, []);

  // The rig: one spot light per light, a small marker where it stands.
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    for (const child of [...t.rig.children]) {
      t.rig.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      if (child instanceof THREE.SpotLight) child.dispose();
    }
    rig.lights.forEach((l, i) => {
      const [r, g, b] = kelvinToRgb(l.warmth);
      const colour = new THREE.Color(`rgb(${r}, ${g}, ${b})`);
      const at = place(l.x, l.y, l.height);
      const spot = new THREE.SpotLight(
        colour,
        (l.strength / 100) * 7,
        0,
        Math.PI / 5 + (l.softness / 100) * (Math.PI / 8),
        0.2 + (l.softness / 100) * 0.75,
        0,
      );
      spot.position.copy(at);
      spot.target.position.set(0, 0.7, 0);
      // One shadow, from the strongest light: enough to read the direction, calm.
      spot.castShadow =
        i === rig.lights.reduce((best, x, j) => (x.strength > rig.lights[best]!.strength ? j : best), 0);
      spot.shadow.mapSize.set(512, 512);
      spot.shadow.radius = 2 + (l.softness / 100) * 10;
      spot.shadow.bias = -0.0008;
      t.rig.add(spot, spot.target);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(l.id === selected ? 0.1 : 0.07, 16, 12),
        new THREE.MeshBasicMaterial({
          color: tokenColour(
            host.current!,
            l.id === selected ? "--ui-action-primary" : "--ui-surface-creative",
            l.id === selected ? "#1A1714" : "#FFFFFF",
          ),
        }),
      );
      marker.position.copy(at);
      t.rig.add(marker);
    });
    t.draw();
  }, [rig, selected]);

  return <div ref={host} className="ui-sl-3d" role="img" aria-label={label} />;
}
