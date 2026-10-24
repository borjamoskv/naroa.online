import * as THREE from 'three'
import { ARTWORKS } from '../artworks'

export const ROTUNDA_RADIUS = 20.0

/**
 * Construye los nodos 3D de la curva Catmull-Rom cerrada que atraviesa
 * los portales arquitectónicos de cada obra con inversión de ejes.
 */
export function buildGallerySplineCurve(radius = ROTUNDA_RADIUS): THREE.CatmullRomCurve3 {
  const numItems = ARTWORKS.length
  const points: THREE.Vector3[] = []

  for (let i = 0; i < numItems; i++) {
    const angle = (i / numItems) * Math.PI * 2
    const nextAngle = ((i + 0.5) / numItems) * Math.PI * 2

    // Punto focal frente al portal de la obra i (cámara de resonancia)
    const viewDist = 4.1
    const yWave = 2.0 + Math.sin(i * 1.35) * 0.28
    points.push(
      new THREE.Vector3(
        Math.sin(angle) * (radius - viewDist),
        yWave,
        Math.cos(angle) * (radius - viewDist)
      )
    )

    // Umbral inter-portal con inversión de eje (inmersión radial + alabeo)
    const archDepth = i % 2 === 0 ? radius - 6.4 : radius - 3.2
    const archY = 2.05 + (i % 2 === 0 ? 0.52 : -0.42)
    points.push(
      new THREE.Vector3(
        Math.sin(nextAngle) * archDepth,
        archY,
        Math.cos(nextAngle) * archDepth
      )
    )
  }

  return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5)
}
