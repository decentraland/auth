import { useEffect, useRef, CSSProperties } from 'react'
import overlayTextureUrl from '../../assets/images/background/DCL_LogoPattern.png'

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform sampler2D u_overlayTex;

varying vec2 v_uv;

const vec4 innerColor = vec4(0.749, 0.0, 1.0, 1.0);
const vec4 outerColor = vec4(0.3176, 0.0235, 0.5176, 1.0);
const float vignetteRadius = 0.167;
const float vignetteSmoothness = 0.5;
const vec4 overlayColor = vec4(1.0, 1.0, 1.0, 1.0);
const float overlayTiling = 1.66;
const vec2 overlayDirection = vec2(1.0, -1.25);
const float overlaySpeed = 0.06;
const float overlayAlpha = 0.573;
const vec4 glowColor = vec4(0.5725, 0.0588, 0.6392, 1.0);
const float glowStrength = 0.17;
const vec2 glowRadiusVec = vec2(0.05, 0.13);
const float glowSmoothness = 3.61;
const vec2 glowCenter = vec2(0.68, 0.5);
const float luminosityStrength = 0.541;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = v_uv;

  // Vignette background
  vec2 centerUV = uv - 0.5;
  float rad = length(centerUV);
  float mask = smoothstep(vignetteRadius + vignetteSmoothness, vignetteRadius, rad);
  vec4 vignette = mix(outerColor, innerColor, mask);

  // Moving overlay texture
  float aspect = u_resolution.x / u_resolution.y;
  vec2 overlayUV = uv;
  overlayUV.x *= overlayTiling * aspect;
  overlayUV.y *= overlayTiling;
  overlayUV += u_time * overlayDirection * overlaySpeed;
  vec4 overlay = texture2D(u_overlayTex, overlayUV) * overlayColor;
  overlay.a *= overlayAlpha * mask;

  // Luminosity blend mode for overlay
  vec3 vignetteHSV = rgb2hsv(vignette.rgb);
  vec3 overlayHSV = rgb2hsv(overlay.rgb);
  float val = mix(0.5, 1.0, overlayHSV.z);
  vec3 luminosityBlend = hsv2rgb(vec3(vignetteHSV.x, vignetteHSV.y, val));
  float luminosityBlendAmount = overlay.a * luminosityStrength;
  vec4 result = vec4(mix(vignette.rgb, luminosityBlend, luminosityBlendAmount), 1.0);

  // Radial glow (aspect-corrected so it stays circular)
  vec2 glowDelta = (uv - glowCenter) / glowRadiusVec;
  glowDelta.x *= aspect;
  float glowDist = length(glowDelta);
  float glowMask = 1.0 - smoothstep(1.0, 1.0 + glowSmoothness, glowDist);
  vec4 glow = glowColor * glowMask * glowStrength;
  result.rgb += glow.rgb * glow.a;

  gl_FragColor = result;
}
`

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

function loadTexture(gl: WebGLRenderingContext, url: string): WebGLTexture | null {
  const texture = gl.createTexture()
  if (!texture) return null
  gl.bindTexture(gl.TEXTURE_2D, texture)

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]))

  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.generateMipmap(gl.TEXTURE_2D)
  }
  image.src = url

  return texture
}

export type AnimatedBackgroundProps = {
  style?: CSSProperties
  className?: string
}

const defaultStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  zIndex: 0
}

export const AnimatedBackground = ({ style, className }: AnimatedBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
    if (!gl) {
      console.error('WebGL not supported')
      return
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vs || !fs) return

    const program = createProgram(gl, vs, fs)
    if (!program) return

    const positionLoc = gl.getAttribLocation(program, 'a_position')
    const timeLoc = gl.getUniformLocation(program, 'u_time')
    const resolutionLoc = gl.getUniformLocation(program, 'u_resolution')
    const overlayTexLoc = gl.getUniformLocation(program, 'u_overlayTex')

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)

    const overlayTexture = loadTexture(gl, overlayTextureUrl)

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth * dpr
      const h = canvas.clientHeight * dpr
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    const startTime = performance.now() / 1000

    const render = () => {
      resize()
      gl.viewport(0, 0, canvas.width, canvas.height)

      gl.useProgram(program)

      gl.uniform1f(timeLoc, performance.now() / 1000 - startTime)
      gl.uniform2f(resolutionLoc, canvas.width, canvas.height)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, overlayTexture)
      gl.uniform1i(overlayTexLoc, 0)

      gl.enableVertexAttribArray(positionLoc)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buffer)
      gl.deleteTexture(overlayTexture)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} style={{ ...defaultStyle, ...style }} />
}
