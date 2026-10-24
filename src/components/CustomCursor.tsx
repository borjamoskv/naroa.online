import { useEffect, useState, useRef } from 'react'

export function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 })
  const [isPointer, setIsPointer] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isClicking, setIsClicking] = useState(false)
  const [cursorLabel, setCursorLabel] = useState<string | null>(null)

  const trailingPos = useRef({ x: -100, y: -100 })
  const [smoothPos, setSmoothPos] = useState({ x: -100, y: -100 })
  const programmaticLabelRef = useRef<string | null>(null)
  const fluidCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Motor Euleriano de Fluidos Navier-Stokes & Advect-Curl (FBO Ping-Pong en WebGL)
  useEffect(() => {
    const canvas = fluidCanvasRef.current
    if (!canvas) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false }
    const gl = (canvas.getContext('webgl2', params) ||
      canvas.getContext('webgl', params) ||
      canvas.getContext('experimental-webgl', params)) as WebGL2RenderingContext | null
    if (!gl) return

    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
    let halfFloatTexType: number
    let supportLinearFiltering = false

    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float')
      supportLinearFiltering = Boolean(gl.getExtension('OES_texture_float_linear'))
      halfFloatTexType = gl.HALF_FLOAT
    } else {
      const hf = gl.getExtension('OES_texture_half_float')
      supportLinearFiltering = Boolean(gl.getExtension('OES_texture_half_float_linear'))
      if (!hf) return
      halfFloatTexType = hf.HALF_FLOAT_OES
    }

    const supportRenderTextureFormat = (internalFormat: number, format: number, type: number) => {
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
      gl.deleteFramebuffer(fbo)
      gl.deleteTexture(texture)
      return status === gl.FRAMEBUFFER_COMPLETE
    }

    const getSupportedFormat = (internalFormat: number, format: number, type: number): { internalFormat: number; format: number } | null => {
      if (!supportRenderTextureFormat(internalFormat, format, type)) {
        if (isWebGL2 && internalFormat === gl.R16F) return getSupportedFormat(gl.RG16F, gl.RG, type)
        if (isWebGL2 && internalFormat === gl.RG16F) return getSupportedFormat(gl.RGBA16F, gl.RGBA, type)
        return null
      }
      return { internalFormat, format }
    }

    const formatRGBA = getSupportedFormat(isWebGL2 ? gl.RGBA16F : gl.RGBA, gl.RGBA, halfFloatTexType)
    const formatRG = isWebGL2 ? getSupportedFormat(gl.RG16F, gl.RG, halfFloatTexType) : formatRGBA
    const formatR = isWebGL2 ? getSupportedFormat(gl.R16F, gl.RED, halfFloatTexType) : formatRGBA
    if (!formatRGBA || !formatRG || !formatR) return

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return shader
    }

    const createProgram = (vsSource: string, fsSource: string) => {
      const program = gl.createProgram()!
      gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource))
      gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource))
      gl.bindAttribLocation(program, 0, 'aPosition')
      gl.linkProgram(program)
      const uniforms: Record<string, WebGLUniformLocation | null> = {}
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(program, i)
        if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name)
      }
      return { program, uniforms, bind: () => gl.useProgram(program) }
    }

    const baseVS = `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `
    const clearProg = createProgram(baseVS, `
      precision mediump float;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;
      uniform float value;
      void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
    `)
    const splatProg = createProgram(baseVS, `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
      }
    `)
    const advectionProg = createProgram(baseVS, `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform float dt;
      uniform float dissipation;
      void main () {
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        gl_FragColor = dissipation * texture2D(uSource, coord);
      }
    `)
    const divergenceProg = createProgram(baseVS, `
      precision mediump float;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;
        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) L = -C.x;
        if (vR.x > 1.0) R = -C.x;
        if (vT.y > 1.0) T = -C.y;
        if (vB.y < 0.0) B = -C.y;
        gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
      }
    `)
    const curlProg = createProgram(baseVS, `
      precision mediump float;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
      }
    `)
    const vorticityProg = createProgram(baseVS, `
      precision highp float;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;
      void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;
        vec2 vel = texture2D(uVelocity, vUv).xy;
        gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
      }
    `)
    const pressureProg = createProgram(baseVS, `
      precision mediump float;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float divergence = texture2D(uDivergence, vUv).x;
        gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
      }
    `)
    const gradSubtractProg = createProgram(baseVS, `
      precision mediump float;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `)
    const displayProg = createProgram(baseVS, `
      precision highp float;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
        float dx = length(texture2D(uTexture, vR).rgb) - length(texture2D(uTexture, vL).rgb);
        float dy = length(texture2D(uTexture, vT).rgb) - length(texture2D(uTexture, vB).rgb);
        vec3 normal = normalize(vec3(-dx * 4.5, -dy * 4.5, 1.0));
        float spec = pow(max(dot(normal, normalize(vec3(0.35, 0.45, 0.82))), 0.0), 18.0) * 0.36;
        vec3 finalColor = c + vec3(spec * 0.95, spec * 0.86, spec * 0.65);
        float alpha = clamp(max(max(finalColor.r, finalColor.g), finalColor.b) * 0.85, 0.0, 0.82);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `)

    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW)
    const ibo = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(0)

    const createFBO = (w: number, h: number, internalFormat: number, format: number, type: number, param: number) => {
      gl.activeTexture(gl.TEXTURE0)
      const texture = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null)
      const fbo = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      gl.viewport(0, 0, w, h)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return {
        texture, fbo, width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
        attach: (id: number) => { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id }
      }
    }

    const createDoubleFBO = (w: number, h: number, internalFormat: number, format: number, type: number, param: number) => {
      let fbo1 = createFBO(w, h, internalFormat, format, type, param)
      let fbo2 = createFBO(w, h, internalFormat, format, type, param)
      return {
        texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
        get read() { return fbo1 },
        get write() { return fbo2 },
        swap() { const t = fbo1; fbo1 = fbo2; fbo2 = t }
      }
    }

    const filtering = supportLinearFiltering ? gl.LINEAR : gl.NEAREST
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const velocity = createDoubleFBO(128, 128, formatRG.internalFormat, formatRG.format, halfFloatTexType, filtering)
    const dye = createDoubleFBO(512, 512, formatRGBA.internalFormat, formatRGBA.format, halfFloatTexType, filtering)
    const divergence = createFBO(128, 128, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST)
    const curl = createFBO(128, 128, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST)
    const pressure = createDoubleFBO(128, 128, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST)

    const blit = (target: { width: number; height: number; fbo: WebGLFramebuffer } | null) => {
      if (!target) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      } else {
        gl.viewport(0, 0, target.width, target.height)
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
    }

    const palette = [
      [0.83, 0.68, 0.22],
      [0.78, 0.83, 0.88],
      [0.72, 0.42, 0.24]
    ]
    let pIdx = 0
    let prevX = -1
    let prevY = -1

    const splat = (x: number, y: number, dx: number, dy: number) => {
      const c = palette[pIdx++ % palette.length]
      splatProg.bind()
      gl.uniform1i(splatProg.uniforms.uTarget, velocity.read.attach(0))
      gl.uniform1f(splatProg.uniforms.aspectRatio, canvas.width / Math.max(1, canvas.height))
      gl.uniform2f(splatProg.uniforms.point, x, y)
      gl.uniform3f(splatProg.uniforms.color, dx, dy, 0)
      gl.uniform1f(splatProg.uniforms.radius, 0.0028)
      blit(velocity.write)
      velocity.swap()

      gl.uniform1i(splatProg.uniforms.uTarget, dye.read.attach(0))
      const intensity = Math.min(1.1, Math.max(0.28, Math.hypot(dx, dy) / 550))
      gl.uniform3f(splatProg.uniforms.color, c[0] * intensity, c[1] * intensity, c[2] * intensity)
      blit(dye.write)
      dye.swap()
    }

    const onMove = (e: PointerEvent) => {
      const x = e.clientX / Math.max(1, window.innerWidth)
      const y = 1 - e.clientY / Math.max(1, window.innerHeight)
      if (prevX < 0) { prevX = x; prevY = y; return }
      const dx = (x - prevX) * window.innerWidth * 6.5
      const dy = (y - prevY) * window.innerHeight * 6.5
      prevX = x; prevY = y
      if (Math.hypot(dx, dy) > 0.25) splat(x, y, dx, dy)
    }

    window.addEventListener('pointermove', onMove, { passive: true })

    let fId: number
    const step = () => {
      const dt = 0.016
      gl.disable(gl.BLEND)

      curlProg.bind()
      gl.uniform2f(curlProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(curlProg.uniforms.uVelocity, velocity.read.attach(0))
      blit(curl)

      vorticityProg.bind()
      gl.uniform2f(vorticityProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(vorticityProg.uniforms.uVelocity, velocity.read.attach(0))
      gl.uniform1i(vorticityProg.uniforms.uCurl, curl.attach(1))
      gl.uniform1f(vorticityProg.uniforms.curl, 28.0)
      gl.uniform1f(vorticityProg.uniforms.dt, dt)
      blit(velocity.write)
      velocity.swap()

      divergenceProg.bind()
      gl.uniform2f(divergenceProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(divergenceProg.uniforms.uVelocity, velocity.read.attach(0))
      blit(divergence)

      clearProg.bind()
      gl.uniform1i(clearProg.uniforms.uTexture, pressure.read.attach(0))
      gl.uniform1f(clearProg.uniforms.value, 0.8)
      blit(pressure.write)
      pressure.swap()

      pressureProg.bind()
      gl.uniform2f(pressureProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(pressureProg.uniforms.uDivergence, divergence.attach(0))
      for (let i = 0; i < 14; i++) {
        gl.uniform1i(pressureProg.uniforms.uPressure, pressure.read.attach(1))
        blit(pressure.write)
        pressure.swap()
      }

      gradSubtractProg.bind()
      gl.uniform2f(gradSubtractProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(gradSubtractProg.uniforms.uPressure, pressure.read.attach(0))
      gl.uniform1i(gradSubtractProg.uniforms.uVelocity, velocity.read.attach(1))
      blit(velocity.write)
      velocity.swap()

      advectionProg.bind()
      gl.uniform2f(advectionProg.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(advectionProg.uniforms.uVelocity, velocity.read.attach(0))
      gl.uniform1i(advectionProg.uniforms.uSource, velocity.read.attach(0))
      gl.uniform1f(advectionProg.uniforms.dt, dt)
      gl.uniform1f(advectionProg.uniforms.dissipation, 0.975)
      blit(velocity.write)
      velocity.swap()

      gl.uniform2f(advectionProg.uniforms.texelSize, dye.texelSizeX, dye.texelSizeY)
      gl.uniform1i(advectionProg.uniforms.uVelocity, velocity.read.attach(0))
      gl.uniform1i(advectionProg.uniforms.uSource, dye.read.attach(1))
      gl.uniform1f(advectionProg.uniforms.dissipation, 0.962)
      blit(dye.write)
      dye.swap()

      displayProg.bind()
      gl.uniform2f(displayProg.uniforms.texelSize, 1 / Math.max(1, canvas.width), 1 / Math.max(1, canvas.height))
      gl.uniform1i(displayProg.uniforms.uTexture, dye.read.attach(0))
      blit(null)

      fId = requestAnimationFrame(step)
    }
    fId = requestAnimationFrame(step)

    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(fId)
    }
  }, [])

  useEffect(() => {
    let animId: number

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY })
      if (!isVisible) setIsVisible(true)

      // Si hay un label programático forzado (ej. durante drag), respetarlo
      if (programmaticLabelRef.current) {
        setCursorLabel(programmaticLabelRef.current)
        setIsPointer(true)
        return
      }

      const target = e.target as HTMLElement | null
      if (target) {
        // 1. Detección de atributo declarativo data-cursor
        const cursorEl = target.closest('[data-cursor]') as HTMLElement | null
        const label = cursorEl ? cursorEl.getAttribute('data-cursor') : null
        setCursorLabel(label)

        // 2. Detección de elementos interactivos
        const isClickable =
          Boolean(label) ||
          window.getComputedStyle(target).cursor === 'pointer' ||
          target.tagName === 'A' ||
          target.tagName === 'BUTTON' ||
          target.closest('a') !== null ||
          target.closest('button') !== null ||
          target.getAttribute('role') === 'button'
        setIsPointer(isClickable)
      }
    }

    // Evento personalizado para mutaciones programáticas (e.g. durante drag continuo)
    const handleCustomCursorEvent = (e: Event) => {
      const customEvt = e as CustomEvent<{ label?: string | null }>
      if (customEvt.detail) {
        const nextLabel = customEvt.detail.label ?? null
        programmaticLabelRef.current = nextLabel
        setCursorLabel(nextLabel)
        if (nextLabel) setIsPointer(true)
      }
    }

    const handleMouseDown = () => setIsClicking(true)
    const handleMouseUp = () => setIsClicking(false)
    const handleMouseLeave = () => setIsVisible(false)
    const handleMouseEnter = () => setIsVisible(true)

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)
    window.addEventListener('naroa:cursor' as any, handleCustomCursorEvent)

    // Interpolación cinemática suave para el seguidor exterior (Lerp factor 0.20)
    const render = () => {
      trailingPos.current.x += (position.x - trailingPos.current.x) * 0.20
      trailingPos.current.y += (position.y - trailingPos.current.y) * 0.20
      setSmoothPos({ x: trailingPos.current.x, y: trailingPos.current.y })
      animId = requestAnimationFrame(render)
    }
    animId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
      window.removeEventListener('naroa:cursor' as any, handleCustomCursorEvent)
      cancelAnimationFrame(animId)
    }
  }, [position, isVisible])

  return (
    <>
      {/* 0. Lienzo Euleriano FBO Ping-Pong (Navier-Stokes & Advect-Curl) */}
      <canvas
        ref={fluidCanvasRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 9999990,
          mixBlendMode: 'screen',
          opacity: 0.85,
        }}
      />

      {isVisible && (
        <>
          {/* 1. Puntero de Artista Soberano (Pincel Naroa con transparencia matérica pura) */}
          <div
            style={{
              position: 'fixed',
              top: position.y,
              left: position.x,
              width: isPointer ? '44px' : '36px',
              height: isPointer ? '44px' : '36px',
              backgroundImage: `url(${isPointer ? "'/assets/cursors/naroa-pincel-pointer-64.png'" : "'/assets/cursors/naroa-pincel-64.png'"})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'top left',
              transform: `translate(-2px, -2px) ${isClicking ? 'rotate(-7deg) scale(0.92)' : 'rotate(0deg) scale(1)'}`,
              transformOrigin: '2px 2px',
              pointerEvents: 'none',
              zIndex: 9999999,
              filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55))',
              transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1), width 0.18s ease, height 0.18s ease',
            }}
          />

          {/* 2. Anillo / Cápsula fluida con mix-blend-mode: difference de alta costura */}
          <div
            style={{
              position: 'fixed',
              top: smoothPos.y,
              left: smoothPos.x,
              transform: `translate(-50%, -50%) scale(${isClicking ? 0.88 : 1})`,
              pointerEvents: 'none',
              zIndex: 9999998,
              mixBlendMode: 'difference',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition:
                'transform 0.12s ease-out, width 0.28s cubic-bezier(0.16, 1, 0.3, 1), height 0.28s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.25s ease, background-color 0.2s ease, border-color 0.2s ease',
              ...(cursorLabel
                ? {
                    minWidth: '78px',
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '16px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #FFFFFF',
                  }
                : isPointer
                ? {
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                    border: '1.5px solid #FFFFFF',
                  }
                : {
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.55)',
                  }),
            }}
          >
            {cursorLabel && (
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: '#000000',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {cursorLabel}
              </span>
            )}
          </div>
        </>
      )}
    </>
  )
}
