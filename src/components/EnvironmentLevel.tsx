import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Entorno arquitectónico sereno y orgánico para las obras de Naroa.
 * La arquitectura no compite con la obra: suelo de piedra volcánica/pizarra apomazada,
 * luz cenital difusa y muros monolíticos curvos de cal y ceniza.
 */
export function EnvironmentLevel() {
  return (
    <group>
      {/* ── 1. SUELO DE PIEDRA NATURAL APOMAZADA (REFLEXIÓN SUAVE Y DIFUSA) ── */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <MeshReflectorMaterial
          blur={[400, 200]}
          resolution={1024}
          mirror={0.25}
          mixBlur={0.92}
          mixStrength={18}
          roughness={0.42}
          depthScale={1.0}
          minDepthThreshold={0.5}
          maxDepthThreshold={1.6}
          color="#0a0a0e"
          metalness={0.2}
        />
      </mesh>

      {/* ── 2. BANCO MONOLÍTICO DE CONTEMPLACIÓN (PIEDRA Y MADERA OSCURA) ── */}
      <group position={[0, 0.22, 0]}>
        {/* Base de piedra */}
        <mesh receiveShadow castShadow>
          <cylinderGeometry args={[2.2, 2.3, 0.44, 48]} />
          <meshStandardMaterial color="#101116" roughness={0.8} metalness={0.1} />
        </mesh>
        {/* Superficie de madera ebanizada */}
        <mesh position={[0, 0.23, 0]}>
          <cylinderGeometry args={[2.1, 2.1, 0.04, 48]} />
          <meshStandardMaterial color="#18181f" roughness={0.65} metalness={0.05} />
        </mesh>
      </group>

      {/* ── 3. MURO PERIMETRAL MONOLÍTICO (ESTUCO MINERAL DE CAL Y CENIZA) ── */}
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[22.5, 22.5, 10, 64, 1, true]} />
        <meshStandardMaterial
          color="#0c0d12"
          roughness={0.92}
          metalness={0.05}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Zócalo discreto de bronce oxidado */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[22.46, 22.46, 0.12, 64, 1, true]} />
        <meshStandardMaterial
          color="#221e16"
          metalness={0.6}
          roughness={0.5}
          side={THREE.BackSide}
        />
      </mesh>

      {/* ── 4. CÚPULA CON ÓCULO DE LUZ NATURAL CENITAL ── */}
      <mesh position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.2, 23, 64]} />
        <meshStandardMaterial color="#08080c" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* Disco de apertura celeste profunda a través del óculo */}
      <mesh position={[0, 10.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.18, 64]} />
        <meshBasicMaterial color="#0b0d16" side={THREE.DoubleSide} />
      </mesh>

      {/* Anillo de bronce arquitectónico del óculo */}
      <mesh position={[0, 9.96, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.1, 4.25, 64]} />
        <meshStandardMaterial
          color="#423b28"
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>

      {/* Haz suave de luz cenital natural desde el óculo */}
      <spotLight
        position={[0, 10.2, 0]}
        target-position={[0, 0, 0]}
        angle={0.55}
        penumbra={1}
        intensity={2.2}
        color="#FFF9F0"
        castShadow
      />
    </group>
  )
}
