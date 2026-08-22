import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";

/**
 * The landing page's 3D layer.
 *
 * The scene is composited over the torii/sakura backplate, so it holds only
 * the moving bodies: the rose moon, the target vehicle, the orbit rings that
 * tie them together, and drifting blossom.
 *
 * Both photographs are colour-graded in the shader rather than used raw. The
 * moon already sits in the palette; the satellite is cool steel and would read
 * as a cut-out pasted onto a warm scene, so it is pushed toward lacquer/plum
 * shadows and rose highlights while keeping its own luminance structure. That
 * is what makes the three assets look photographed together rather than
 * collected separately.
 */

const LACQUER = 0x7a221e;
const MOSS = 0x5c6300;
const PETAL = 0xf2b8c6;

interface OrbitalSceneProps {
  /** 0 at the top of the page, 1 at the bottom of the hero's scroll range. */
  scrollProgressRef: React.MutableRefObject<number>;
  className?: string;
}

/**
 * Duotone-style grade applied to a photographic sprite.
 *
 * Luminance drives a ramp from a deep plum shadow through a warm mid to a
 * near-white rose highlight; `uBlend` mixes that ramp back against the source
 * so the subject keeps its own material detail. `uWarm` biases the result
 * toward the backplate's colour temperature.
 */
const GRADED_SPRITE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uShadow;
  uniform vec3 uMid;
  uniform vec3 uHighlight;
  uniform float uBlend;
  uniform float uOpacity;
  uniform float uWarm;
  uniform vec3 uHazeColor;
  uniform float uHaze;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(uMap, vUv);
    if (texel.a < 0.01) discard;

    float lum = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));

    // Two-segment ramp so mid-tones stay controllable.
    vec3 ramp = lum < 0.5
      ? mix(uShadow, uMid, smoothstep(0.0, 0.5, lum))
      : mix(uMid, uHighlight, smoothstep(0.5, 1.0, lum));

    vec3 graded = mix(texel.rgb, ramp, uBlend);

    // Nudge toward the backplate's warmth without crushing saturation.
    graded = mix(graded, graded * vec3(1.08, 0.94, 0.96), uWarm);

    // Atmospheric perspective: the plate is a misty scene, so a body sitting
    // in it must lose some contrast to the haze. Without this the sprite reads
    // as a sticker on top of the photograph rather than a subject inside it.
    graded = mix(graded, uHazeColor, uHaze);

    gl_FragColor = vec4(graded, texel.a * uOpacity);
  }
`;

const SPRITE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function OrbitalScene({ scrollProgressRef, className = "" }: OrbitalSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let teardown = () => {};

    // Dynamic import: three is ~250 kB gzipped and is never needed to render
    // the page's text, so it loads after paint and stays out of the SSR bundle.
    void (async () => {
      const THREE: typeof THREE_NS = await import("three");
      if (disposed) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
      camera.position.set(0, 0.6, 26);

      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
      } catch {
        // No WebGL — the backplate alone still carries the page.
        return;
      }

      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";

      const disposables: Array<{ dispose: () => void }> = [];
      const track = <T extends { dispose: () => void }>(o: T): T => {
        disposables.push(o);
        return o;
      };

      const world = new THREE.Group();
      scene.add(world);

      // ── Textures ──────────────────────────────────────────────
      const loader = new THREE.TextureLoader();
      const loadTex = (url: string) => {
        const tex = loader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return track(tex);
      };

      const moonTex = loadTex("/moon.png");
      const craftTex = loadTex("/sattelite.png");

      const gradedMaterial = (
        tex: THREE_NS.Texture,
        opts: {
          shadow: number;
          mid: number;
          highlight: number;
          blend: number;
          opacity: number;
          warm: number;
          haze: number;
        },
      ) =>
        track(
          new THREE.ShaderMaterial({
            uniforms: {
              uMap: { value: tex },
              uShadow: { value: new THREE.Color(opts.shadow) },
              uMid: { value: new THREE.Color(opts.mid) },
              uHighlight: { value: new THREE.Color(opts.highlight) },
              uBlend: { value: opts.blend },
              uOpacity: { value: opts.opacity },
              uWarm: { value: opts.warm },
              // Sampled from the backplate's mid-scene mist.
              uHazeColor: { value: new THREE.Color(0xe8cfe0) },
              uHaze: { value: opts.haze },
            },
            vertexShader: SPRITE_VERT,
            fragmentShader: GRADED_SPRITE_FRAG,
            transparent: true,
            depthWrite: false,
          }),
        );

      // ── The moon: high and to the right, clear of the backplate's own sun
      const MOON_W = 26;
      const moon = new THREE.Mesh(
        track(new THREE.PlaneGeometry(MOON_W, MOON_W * (408 / 612))),
        // Only a light grade: this photograph is already in the palette.
        gradedMaterial(moonTex, {
          shadow: 0x6d1f33,
          mid: 0xd4708a,
          highlight: 0xfde8ee,
          blend: 0.32,
          opacity: 0.92,
          warm: 0.25,
          // Farthest body, but a bright one — only a touch of haze.
          haze: 0.1,
        }),
      );
      moon.position.set(9.5, 7.0, -34);
      world.add(moon);

      // A soft bloom disc behind it so it sits in the haze rather than on it.
      const moonGlow = new THREE.Mesh(
        track(new THREE.CircleGeometry(MOON_W * 0.42, 64)),
        track(
          new THREE.MeshBasicMaterial({
            color: 0xffc9d8,
            transparent: true,
            opacity: 0.16,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        ),
      );
      moonGlow.position.set(9.5, 7.0, -35);
      world.add(moonGlow);

      // ── Orbit rings, tinted to the backplate instead of ink
      const rings = new THREE.Group();
      const ringSpecs: Array<[number, number, number, number, number]> = [
        // [radius, tiltX, tiltY, opacity, colour]
        [13.5, 1.32, 0.12, 0.3, LACQUER],
        [16.5, 1.18, -0.35, 0.18, 0xb0577a],
        [10.2, 1.46, 0.52, 0.22, MOSS],
      ];
      for (const [radius, rx, ry, opacity, colour] of ringSpecs) {
        const ring = new THREE.Mesh(
          track(new THREE.RingGeometry(radius, radius + 0.04, 220)),
          track(
            new THREE.MeshBasicMaterial({
              color: colour,
              transparent: true,
              opacity,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          ),
        );
        ring.rotation.set(rx, ry, 0);
        rings.add(ring);
      }
      world.add(rings);

      // The active approach corridor
      const corridor = new THREE.Mesh(
        track(new THREE.RingGeometry(7.4, 7.5, 180, 1, 0, Math.PI * 1.35)),
        track(
          new THREE.MeshBasicMaterial({
            color: MOSS,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        ),
      );
      corridor.rotation.set(1.28, 0.2, 0.4);
      world.add(corridor);

      // ── The target vehicle, graded into the scene's colour temperature
      const CRAFT_W = 13;
      const craft = new THREE.Group();
      const craftPlane = new THREE.Mesh(
        track(new THREE.PlaneGeometry(CRAFT_W, CRAFT_W * (406 / 614))),
        // Heavier grade: the source is cool steel and would otherwise read as
        // a cut-out dropped onto a warm sky.
        gradedMaterial(craftTex, {
          shadow: 0x4a2440,
          mid: 0xb87a8e,
          // Rose rather than white: a near-white highlight blew the hull out
          // into a pale cut-out that sat on the plate instead of in it.
          highlight: 0xf6d7dd,
          blend: 0.72,
          opacity: 0.96,
          warm: 0.7,
          haze: 0.2,
        }),
      );
      craft.add(craftPlane);
      world.add(craft);

      // ── Blossom, instanced so 140 petals cost one draw call
      const petalShape = new THREE.Shape();
      petalShape.moveTo(0, 0);
      petalShape.bezierCurveTo(0.16, 0.1, 0.2, 0.36, 0, 0.5);
      petalShape.bezierCurveTo(-0.2, 0.36, -0.16, 0.1, 0, 0);
      const petalGeom = track(new THREE.ShapeGeometry(petalShape, 10));
      const petalMat = track(
        new THREE.MeshBasicMaterial({
          color: PETAL,
          transparent: true,
          opacity: 0.82,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      const PETAL_COUNT = 140;
      const petals = new THREE.InstancedMesh(petalGeom, petalMat, PETAL_COUNT);
      petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      world.add(petals);

      const petalState = Array.from({ length: PETAL_COUNT }, () => ({
        x: (Math.random() - 0.5) * 46,
        y: Math.random() * 34 - 14,
        z: (Math.random() - 0.5) * 26 + 2,
        fall: 0.6 + Math.random() * 1.5,
        sway: 0.4 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.4,
        scale: 0.5 + Math.random() * 0.9,
      }));
      const dummy = new THREE.Object3D();

      // ── Distant glints, warm rather than ink so they read as sky sparkle
      const starCount = 320;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 46 + Math.random() * 90;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i * 3 + 1] = Math.abs(r * Math.sin(phi) * Math.sin(theta)) * 0.7;
        starPos[i * 3 + 2] = -Math.abs(r * Math.cos(phi)) * 0.6 - 12;
      }
      const starGeom = track(new THREE.BufferGeometry());
      starGeom.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      const stars = new THREE.Points(
        starGeom,
        track(
          new THREE.PointsMaterial({
            color: 0xfff0f4,
            size: 0.55,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          }),
        ),
      );
      world.add(stars);

      // ── Pointer parallax
      const pointer = { x: 0, y: 0 };
      const target = { x: 0, y: 0 };
      const onPointerMove = (e: PointerEvent) => {
        target.x = (e.clientX / window.innerWidth) * 2 - 1;
        target.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });

      // ── Layout: bias the composition off the text column
      const layout = () => {
        const w = mount.clientWidth || window.innerWidth;
        const narrow = w < 900;
        world.position.x = narrow ? 3.0 : 6.5;
        world.position.z = narrow ? -8 : 0;
        world.scale.setScalar(narrow ? 0.7 : 1);
        craft.position.x = narrow ? -1.5 : 0;
      };

      const resize = () => {
        const w = mount.clientWidth || window.innerWidth;
        const h = mount.clientHeight || window.innerHeight;
        // A hidden or collapsed pane reports zero, which would make the camera
        // aspect NaN and blank the scene permanently once it reappears.
        if (w < 1 || h < 1) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        layout();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(mount);

      // ── Frame loop
      const clock = new THREE.Clock();
      let raf = 0;

      const renderFrame = () => {
        const t = clock.getElapsedTime();
        const progress = scrollProgressRef.current;

        if (!reduced) {
          // Scroll dollies the camera in and tips the scene forward, so the
          // vehicle appears to close on the viewer as the page advances.
          camera.position.z = 26 - progress * 11;
          camera.position.y = 0.6 + progress * 2.4;
          world.rotation.x = progress * 0.28;

          pointer.x += (target.x - pointer.x) * 0.05;
          pointer.y += (target.y - pointer.y) * 0.05;
          world.rotation.y = pointer.x * 0.16 + t * 0.014;
          camera.position.x = pointer.x * 1.6;
          camera.lookAt(0, 0.4 + progress * 1.2, 0);

          // A flat sprite cannot spin on Y without vanishing edge-on, so the
          // vehicle gets a bounded sway that still reads as tumbling.
          craft.rotation.y = Math.sin(t * 0.28) * 0.34;
          craft.rotation.z = Math.sin(t * 0.21) * 0.12;
          craft.rotation.x = Math.sin(t * 0.35) * 0.09;
          craft.position.y = Math.sin(t * 0.5) * 0.45;

          // Keep the moon square to camera as the world turns beneath it.
          moon.rotation.y = -world.rotation.y;
          moonGlow.rotation.y = -world.rotation.y;

          rings.rotation.z = t * 0.035;
          corridor.rotation.z = 0.4 - t * 0.05;
          stars.rotation.y = t * 0.006;

          for (let i = 0; i < PETAL_COUNT; i++) {
            const p = petalState[i]!;
            p.y -= p.fall * 0.035;
            if (p.y < -18) {
              p.y = 20;
              p.x = (Math.random() - 0.5) * 46;
            }
            dummy.position.set(p.x + Math.sin(t * p.sway + p.phase) * 1.5, p.y, p.z);
            dummy.rotation.set(t * p.spin * 0.6, t * p.spin, p.phase + t * p.spin * 0.4);
            dummy.scale.setScalar(p.scale);
            dummy.updateMatrix();
            petals.setMatrixAt(i, dummy.matrix);
          }
          petals.instanceMatrix.needsUpdate = true;
        }

        renderer.render(scene, camera);
        raf = requestAnimationFrame(renderFrame);
      };

      // Seed the petal matrices so a reduced-motion render is not a blank sky.
      for (let i = 0; i < PETAL_COUNT; i++) {
        const p = petalState[i]!;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.phase, p.phase, p.phase);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        petals.setMatrixAt(i, dummy.matrix);
      }
      petals.instanceMatrix.needsUpdate = true;

      raf = requestAnimationFrame(renderFrame);

      teardown = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        for (const d of disposables) d.dispose();
        petals.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      };

      // The import may resolve after an immediate unmount; honour that here.
      if (disposed) teardown();
    })();

    return () => {
      disposed = true;
      teardown();
    };
  }, [scrollProgressRef]);

  return <div ref={mountRef} className={className} aria-hidden />;
}
