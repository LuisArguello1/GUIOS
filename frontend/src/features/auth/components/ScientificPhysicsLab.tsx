import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface CharParticle {
    el: HTMLSpanElement;
    originX: number;
    originY: number;
    width: number;
    height: number;
    dx: number;
    dy: number;
    vx: number;
    vy: number;
    angle: number;
    vAngle: number;
    state: 'idle' | 'falling' | 'returning';
    detachedAt: number;
}

/**
 * Divide el texto en palabras y caracteres individuales sin contenedores visibles,
 * permitiendo que cada letra caiga libremente al contacto del cursor
 * y luego regrese a su lugar exacto.
 */
const InteractiveText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
    const words = text.split(' ');
    return (
        <span className={className}>
            {words.map((word, wIdx) => (
                <React.Fragment key={wIdx}>
                    <span className="inline-block whitespace-nowrap">
                        {Array.from(word).map((char, cIdx) => (
                            <span
                                key={cIdx}
                                data-physics-char="true"
                                className="inline-block will-change-transform select-none"
                            >
                                {char}
                            </span>
                        ))}
                    </span>
                    {wIdx < words.length - 1 ? ' ' : ''}
                </React.Fragment>
            ))}
        </span>
    );
};

export const ScientificPhysicsLab: React.FC = () => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const threeStageRef = useRef<HTMLDivElement | null>(null);
    const particlesRef = useRef<CharParticle[]>([]);
    const animFrameRef = useRef<number | null>(null);
    const mouseRef = useRef<{
        x: number;
        y: number;
        prevX: number;
        prevY: number;
        vx: number;
        vy: number;
        normX: number;
        normY: number;
        active: boolean;
    }>({
        x: -1000,
        y: -1000,
        prevX: -1000,
        prevY: -1000,
        vx: 0,
        vy: 0,
        normX: 0,
        normY: 0,
        active: false,
    });

    const measureParticles = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const charEls = container.querySelectorAll<HTMLSpanElement>('[data-physics-char="true"]');

        if (particlesRef.current.length === charEls.length && particlesRef.current.length > 0) {
            particlesRef.current.forEach((p) => {
                const rect = p.el.getBoundingClientRect();
                p.originX = rect.left - containerRect.left - p.dx + rect.width / 2;
                p.originY = rect.top - containerRect.top - p.dy + rect.height / 2;
                p.width = rect.width;
                p.height = rect.height;
            });
            return;
        }

        const newParticles: CharParticle[] = [];
        charEls.forEach((el) => {
            el.style.transform = '';
            const rect = el.getBoundingClientRect();
            newParticles.push({
                el,
                originX: rect.left - containerRect.left + rect.width / 2,
                originY: rect.top - containerRect.top + rect.height / 2,
                width: rect.width,
                height: rect.height,
                dx: 0,
                dy: 0,
                vx: 0,
                vy: 0,
                angle: 0,
                vAngle: 0,
                state: 'idle',
                detachedAt: 0,
            });
        });

        particlesRef.current = newParticles;
    }, []);

    const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    };

    // 1. Motor de Físicas para el Texto
    useEffect(() => {
        const timer = setTimeout(measureParticles, 60);
        if (document.fonts?.ready) {
            document.fonts.ready.then(measureParticles).catch(() => {});
        }

        window.addEventListener('resize', measureParticles);

        const gravity = 0.52;
        const floorBounce = 0.45;
        const floorFriction = 0.82;
        const airDrag = 0.992;
        const returnDelayMs = 2800;
        const triggerRadius = 32;

        const loop = (now: number) => {
            const container = containerRef.current;
            if (container) {
                const containerW = container.clientWidth;
                const containerH = container.clientHeight;
                const floorY = containerH - 22;
                const mouse = mouseRef.current;
                const particles = particlesRef.current;

                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    const currX = p.originX + p.dx;
                    const currY = p.originY + p.dy;

                    if (mouse.active) {
                        const dist = distToSegment(
                            currX,
                            currY,
                            mouse.prevX,
                            mouse.prevY,
                            mouse.x,
                            mouse.y
                        );

                        if (dist < triggerRadius) {
                            if (p.state === 'idle' || p.state === 'returning') {
                                p.state = 'falling';
                                p.detachedAt = now;
                                p.vx = mouse.vx * 0.18 + (Math.random() - 0.5) * 2.8;
                                p.vy = Math.max(-1.8, mouse.vy * 0.12) + Math.random() * 1.2;
                                p.vAngle = (Math.random() - 0.5) * 9;
                            } else if (p.state === 'falling') {
                                const pushX = currX - mouse.x;
                                const pushY = currY - mouse.y;
                                const norm = Math.hypot(pushX, pushY) || 1;
                                p.vx += (pushX / norm) * 2.2 + mouse.vx * 0.1;
                                p.vy += (pushY / norm) * 2.2 - 1.5;
                                p.vAngle += (Math.random() - 0.5) * 6;
                                p.detachedAt = now;
                            }
                        }
                    }

                    if (p.state === 'falling') {
                        p.vy += gravity;
                        p.vx *= airDrag;

                        p.dx += p.vx;
                        p.dy += p.vy;
                        p.angle += p.vAngle;
                        p.vAngle *= 0.98;

                        const nextX = p.originX + p.dx;
                        const nextY = p.originY + p.dy;
                        const halfH = p.height / 2;
                        const halfW = p.width / 2;

                        if (nextY + halfH > floorY) {
                            p.dy = floorY - p.originY - halfH;
                            p.vy = -p.vy * floorBounce;
                            p.vx *= floorFriction;
                            p.vAngle *= 0.7;

                            if (Math.abs(p.vy) < 0.8) {
                                p.vy = 0;
                            }
                        }

                        if (nextX - halfW < 16) {
                            p.dx = 16 + halfW - p.originX;
                            p.vx = Math.abs(p.vx) * 0.6;
                        } else if (nextX + halfW > containerW - 16) {
                            p.dx = containerW - 16 - halfW - p.originX;
                            p.vx = -Math.abs(p.vx) * 0.6;
                        }

                        p.el.style.transform = `translate3d(${p.dx.toFixed(1)}px, ${p.dy.toFixed(1)}px, 0) rotate(${p.angle.toFixed(1)}deg)`;

                        if (now - p.detachedAt > returnDelayMs) {
                            p.state = 'returning';
                        }
                    } else if (p.state === 'returning') {
                        p.dx *= 0.85;
                        p.dy *= 0.85;
                        p.angle *= 0.82;
                        p.vx = 0;
                        p.vy = 0;

                        if (Math.abs(p.dx) < 0.35 && Math.abs(p.dy) < 0.35 && Math.abs(p.angle) < 0.4) {
                            p.dx = 0;
                            p.dy = 0;
                            p.angle = 0;
                            p.vAngle = 0;
                            p.state = 'idle';
                            p.el.style.transform = '';
                        } else {
                            p.el.style.transform = `translate3d(${p.dx.toFixed(1)}px, ${p.dy.toFixed(1)}px, 0) rotate(${p.angle.toFixed(1)}deg)`;
                        }
                    }
                }

                mouse.prevX = mouse.x;
                mouse.prevY = mouse.y;
                mouse.vx *= 0.5;
                mouse.vy *= 0.5;
            }

            animFrameRef.current = requestAnimationFrame(loop);
        };

        animFrameRef.current = requestAnimationFrame(loop);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', measureParticles);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [measureParticles]);

    // 2. Escena Three.js: Hoja Base con Shader Procedural de Viento, Resorte Interactivo al Mouse y Escritura UV
    useEffect(() => {
        const stage = threeStageRef.current;
        if (!stage) return;

        let isMounted = true;
        const width = stage.clientWidth || 480;
        const height = stage.clientHeight || 360;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);

        // Uniforms compartidos: hoja y texto usan EXACTAMENTE la misma deformación
        const U = {
            uTime: { value: 0 }, // ciclo de escritura (0..12 s)
            uWind: { value: 0 }, // fase del viento (0..2π)
            uMouse: { value: new THREE.Vector2() }, // cursor sobre la hoja
            uLift: { value: 0 }, // levantamiento (resorte)
            uAmp: { value: 1 }, // intensidad del aleteo
        };

        const POSE_GLSL = /* glsl */ `
uniform float uWind; uniform vec2 uMouse; uniform float uLift; uniform float uAmp;

// b = coordenadas Blender (x, y, z)
vec3 pose(vec3 b) {
  float a = uWind;
  float ry = 0.07*sin(a), rx = 0.05*sin(a+1.1), rz = 0.04*sin(a+2.0);
  float x = b.x, y = b.y, z = b.z;
  float x1 = x*cos(ry) + z*sin(ry);
  float z1 = -x*sin(ry) + z*cos(ry);
  float y1 = y*cos(rx) - z1*sin(rx);
  float z2 = y*sin(rx) + z1*cos(rx);
  float x2 = x1*cos(rz) - y1*sin(rz);
  float y2 = x1*sin(rz) + y1*cos(rz);
  float f = 0.35 + 0.65*(0.5 - y/4.0);
  float wave = f*(0.085*sin(a - 2.4*x - 1.7*y) + 0.045*sin(2.0*a - 3.3*y + 1.9*x + 0.8));
  float br = pow((x/3.0 + 0.5)*(0.5 - y/4.0), 2.0);
  float corner = 0.30*br*sin(a + 0.6);
  float bob = 0.05*sin(a + 2.0);

  // reacción al mouse: bulto que se levanta + ola que sale del cursor
  float d = length(b.xy - uMouse);
  float g = exp(-d*d/(2.0*0.55*0.55));
  float lift = uLift*(0.75*g + 0.08);
  float ripple = uLift*0.06*sin(d*9.0 - uWind*2.0)*exp(-d*0.9);

  return vec3(x2, y2, z2 + (wave + corner)*uAmp + bob + lift + ripple);
}`;

        function patch(material: THREE.Material, isLines: boolean) {
            material.side = THREE.DoubleSide;
            material.customProgramCacheKey = () => (isLines ? 'lines' : 'sheet');
            material.onBeforeCompile = (shader) => {
                Object.assign(shader.uniforms, U);

                shader.vertexShader = shader.vertexShader
                    .replace('void main() {', POSE_GLSL + (isLines ? '\nvarying vec2 vLUv;' : '') + '\nvoid main() {')
                    .replace(
                        '#include <beginnormal_vertex>',
                        `
                        #include <beginnormal_vertex>
                        {
                          vec3 bp = vec3(position.x, -position.z, position.y);
                          vec3 n0 = vec3(objectNormal.x, -objectNormal.z, objectNormal.y);
                          float nzc = max(abs(n0.z), 0.2) * (n0.z < 0.0 ? -1.0 : 1.0);
                          float zx = -n0.x/nzc, zy = -n0.y/nzc;
                          float e = 0.03;
                          vec3 pA = pose(bp);
                          vec3 pX = pose(bp + vec3(e, 0.0, e*zx));
                          vec3 pY = pose(bp + vec3(0.0, e, e*zy));
                          vec3 nB = normalize(cross(pX - pA, pY - pA));
                          objectNormal = vec3(nB.x, nB.z, -nB.y);
                        }`
                    )
                    .replace(
                        '#include <begin_vertex>',
                        `
                        #include <begin_vertex>
                        {
                          vec3 pb = pose(vec3(position.x, -position.z, position.y));
                          transformed = vec3(pb.x, pb.z, -pb.y);
                        }
                        ${isLines ? 'vLUv = uv;' : ''}`
                    );

                if (isLines) {
                    shader.fragmentShader = shader.fragmentShader.replace(
                        'void main() {',
                        `
                        uniform float uTime;
                        varying vec2 vLUv;
                        void main() {
                          float pw = clamp((uTime - vLUv.y * 5.6) / 1.6, 0.0, 1.0);        // escribir
                          float er = clamp((uTime - 9.6 - vLUv.y * 0.5) / 1.2, 0.0, 1.0);  // borrar
                          if (!(vLUv.x < pw && vLUv.x > er)) discard;
                        `
                    );
                }
            };
            material.needsUpdate = true;
        }

        // Encuadre calibrado para que la hoja sea elegante, proporcionada y quepa holgadamente
        const updateCameraFraming = (w: number, h: number) => {
            const aspect = w / (h || 1);
            camera.aspect = aspect;

            // Medidas del modelo: alto ~4.0, ancho ~3.0
            // Hacemos que ocupe ~76-78% de la altura útil: proporcionada y dejando margen limpio
            const halfFovRad = (camera.fov * Math.PI) / 360;
            const halfTan = Math.tan(halfFovRad); // ~0.3153
            const distForHeight = (4.0 / 0.77) / (2 * halfTan); // ~8.24
            const distForWidth = (3.0 / 0.74) / (2 * halfTan * aspect);

            const targetZ = Math.max(distForHeight, distForWidth);
            camera.position.set(0, 0, targetZ);
            camera.updateProjectionMatrix();
        };

        updateCameraFraming(width, height);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        stage.innerHTML = '';
        stage.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbcc, 1.4));
        const sun = new THREE.DirectionalLight(0xfff4e6, 2.2);
        sun.position.set(-4, 5, 6);
        scene.add(sun);

        const loader = new GLTFLoader();
        loader.load(
            '/3d/hoja_base.glb',
            (gltf) => {
                if (!isMounted) return;
                const root = gltf.scene;
                root.rotation.x = Math.PI / 2; // la hoja queda de frente a la cámara
                scene.add(root);

                root.traverse((o) => {
                    const mesh = o as THREE.Mesh;
                    if (!mesh.isMesh) return;
                    mesh.frustumCulled = false; // la deformación del shader mueve los vértices
                    const isLines = mesh.name === 'Lineas' || mesh.name.startsWith('Lineas');
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach((m) => patch(m, isLines));
                    } else if (mesh.material) {
                        patch(mesh.material, isLines);
                    }
                });

                if (stage) {
                    updateCameraFraming(stage.clientWidth || width, stage.clientHeight || height);
                }
            },
            undefined,
            (err) => {
                console.error('Error cargando hoja_base.glb:', err);
            }
        );

        // ---- Mouse & Resorte Interactivo ----
        const raycaster = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const ndc = new THREE.Vector2();
        const hit = new THREE.Vector3();
        const target = new THREE.Vector2();
        let inside = false;
        let liftVel = 0;

        const handlePointerMove = (e: MouseEvent) => {
            if (!renderer.domElement) return;
            const rect = renderer.domElement.getBoundingClientRect();
            const inCanvas =
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;

            ndc.set(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );
            raycaster.setFromCamera(ndc, camera);
            if (raycaster.ray.intersectPlane(plane, hit)) {
                target.set(hit.x, hit.y);
                const was = inside;
                inside = inCanvas && Math.abs(hit.x) < 1.6 && Math.abs(hit.y) < 2.1;
                if (inside) liftVel += Math.min(Math.hypot(e.movementX, e.movementY) * 0.02, 0.6);
                if (inside && !was) liftVel += 1.5; // "empujón" al entrar
            } else {
                inside = false;
            }
        };

        const handlePointerLeave = () => {
            inside = false;
        };

        window.addEventListener('mousemove', handlePointerMove);
        document.addEventListener('mouseleave', handlePointerLeave);

        // ---- Animation Loop ----
        const clock = new THREE.Clock();
        let t = 0;
        let lift = 0;

        renderer.setAnimationLoop(() => {
            const dt = Math.min(clock.getDelta(), 1 / 30);
            t += dt;

            U.uTime.value = t % 12.0; // ciclo de escritura (0..12 s)
            U.uWind.value = ((t % 6.0) / 6.0) * Math.PI * 2; // fase del viento (0..2π)

            // Resorte con rebote para el levantamiento
            const k = 38;
            const c = 6.5;
            liftVel += (k * ((inside ? 1 : 0) - lift) - c * liftVel) * dt;
            lift = Math.min(Math.max(lift + liftVel * dt, 0), 1.6);
            U.uLift.value = lift;
            U.uAmp.value = 1 + 0.9 * Math.min(lift, 1.2); // aletea más con el mouse encima
            U.uMouse.value.lerp(target, 1 - Math.exp(-dt * 10));

            renderer.render(scene, camera);
        });

        const handleResize = () => {
            if (!stage) return;
            const newW = stage.clientWidth || 480;
            const newH = stage.clientHeight || 360;
            updateCameraFraming(newW, newH);
            renderer.setSize(newW, newH);
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(stage);
        window.addEventListener('resize', handleResize);

        return () => {
            isMounted = false;
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handlePointerMove);
            document.removeEventListener('mouseleave', handlePointerLeave);
            renderer.setAnimationLoop(null);
            renderer.dispose();
            if (renderer.domElement && renderer.domElement.parentNode === stage) {
                stage.removeChild(renderer.domElement);
            }
        };
    }, []);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const m = mouseRef.current;
        if (!m.active) {
            m.prevX = x;
            m.prevY = y;
        }
        m.vx = x - m.x;
        m.vy = y - m.y;
        m.x = x;
        m.y = y;
        m.normX = (x / (rect.width || 1)) * 2 - 1;
        m.normY = (y / (rect.height || 1)) * 2 - 1;
        m.active = true;
    };

    const handleMouseLeave = () => {
        mouseRef.current.active = false;
    };

    return (
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative w-full h-full flex flex-col justify-between px-6 sm:px-8 xl:px-12 pt-5 pb-3 bg-[var(--color-bg-page)] text-[var(--color-text-primary)] overflow-hidden select-none min-h-0"
        >
            {/* 1. Cabecera y Resumen Técnico Compacto con Letras Interactivas */}
            <div className="relative z-10 space-y-1.5 max-w-[500px] shrink-0">
                <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--color-text-tertiary)]">
                    <InteractiveText text="GUIOS • EVALUACIÓN FLOSS & FODA" />
                </p>

                <h2 className="text-[19px] xl:text-[22px] font-black tracking-tight leading-[1.2] text-[var(--color-text-primary)]">
                    <InteractiveText text="Modelo Cuantitativo de Adopción de Software Libre" />
                </h2>

                <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                    <InteractiveText text="Auditoría multicriterio sobre 18 factores técnicos y organizacionales con respaldo bibliométrico y clasificación estratégica FODA." />
                </p>
            </div>

            {/* 2. Escenario 3D: Hoja con Viento y Escritura Shader (Three.js) */}
            <div
                id="guios-3d-stage"
                ref={threeStageRef}
                className="relative flex-1 w-full min-h-[220px] flex items-center justify-center my-auto min-h-0"
            />
        </div>
    );
};

export default ScientificPhysicsLab;
