import { Grid } from '@react-three/drei'

export function EnvironmentLevel() {
  return (
    <group>
      {/* Suelo Arquitectónico de Terrazo Oscuro y Obsidiana con Reflejos Sutiles */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          color="#050508"
          roughness={0.2}
          metalness={0.7}
        />
      </mesh>

      {/* Retícula Arquitectónica Minimalista en Oro Pálido (Estándar Museo de Arte Contemporáneo) */}
      <Grid
        position={[0, 0, 0]}
        args={[60, 60]}
        cellSize={2}
        cellThickness={0.8}
        cellColor="#1c1d24"
        sectionSize={6}
        sectionThickness={1.2}
        sectionColor="#D4AF37"
        fadeDistance={35}
        fadeStrength={1.5}
      />

      {/* Anillo de Pavimento Central del Pabellón */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[9.5, 10.5, 64]} />
        <meshBasicMaterial color="#D4AF37" transparent opacity={0.2} />
      </mesh>

      {/* Techo Oscuro del Pabellón Arquitectónico */}
      <mesh position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#020204" roughness={0.9} />
      </mesh>
    </group>
  )
}
