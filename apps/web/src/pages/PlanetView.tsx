import { useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import * as THREE from "three";

export default function PlanetView() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useDocumentMeta({
    title: "Planet Visualization",
    description: "3D civilization viewer with zoom layers for planet, city, district, and plot activity.",
  });

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#020617");

    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / 420, 0.1, 1000);
    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, 420);
    el.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(2, 2, 3);
    scene.add(light);

    const ambient = new THREE.AmbientLight(0x60a5fa, 0.35);
    scene.add(ambient);

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 48, 48),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.65, metalness: 0.15 }),
    );
    scene.add(globe);

    const routes = new THREE.Group();
    const routeMaterial = new THREE.LineBasicMaterial({ color: 0xf59e0b });
    [
      [new THREE.Vector3(0.7, 0.8, 0.6), new THREE.Vector3(-0.4, 0.3, 1.05)],
      [new THREE.Vector3(-0.8, 0.2, 0.8), new THREE.Vector3(0.6, -0.5, 0.9)],
      [new THREE.Vector3(0.1, -0.9, 0.8), new THREE.Vector3(-0.6, 0.7, 0.8)],
    ].forEach(([a, b]) => {
      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      routes.add(new THREE.Line(geo, routeMaterial));
    });
    scene.add(routes);

    let raf = 0;
    const animate = () => {
      globe.rotation.y += 0.003;
      routes.rotation.y += 0.002;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      camera.aspect = w / 420;
      camera.updateProjectionMatrix();
      renderer.setSize(w, 420);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <h1 className="text-3xl font-bold">Synth World Planet</h1>
        <Card>
          <CardHeader>
            <CardTitle>3D Planet Civilization View</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={mountRef} className="w-full rounded-lg border overflow-hidden" />
            <p className="text-xs text-muted-foreground mt-3">
              Zoom tiers planned: planet → continent → city → district → plot. Current view renders city nodes and trade routes with Three.js.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
