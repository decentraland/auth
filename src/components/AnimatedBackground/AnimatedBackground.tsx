import { useEffect, useRef } from 'react'
import overlayTextureUrl from '../../assets/images/background/DCL_LogoPattern.png'
import { FRAGMENT_SHADER, VERTEX_SHADER } from './AnimatedBackground.shaders'
import { type LoadedTexture, createProgram, createShader, loadTexture } from './AnimatedBackground.utils'
import { AnimatedBackgroundProps } from './AnimatedBackground.types'
import { Canvas, Fallback, Wrapper } from './AnimatedBackground.styled'

const AnimatedBackground = ({ variant = 'fixed' }: AnimatedBackgroundProps) => {
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

    // GL resources are tracked here so teardown() can release them and so the context can be
    // rebuilt from scratch when it is restored after a loss.
    let program: WebGLProgram | null = null
    let vs: WebGLShader | null = null
    let fs: WebGLShader | null = null
    let buffer: WebGLBuffer | null = null
    let textureLoader: LoadedTexture | null = null
    let contextLost = false

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth * dpr
      const h = canvas.clientHeight * dpr
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    const setup = () => {
      vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
      fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
      if (!vs || !fs) return

      program = createProgram(gl, vs, fs)
      if (!program) return

      const positionLoc = gl.getAttribLocation(program, 'a_position')
      const timeLoc = gl.getUniformLocation(program, 'u_time')
      const resolutionLoc = gl.getUniformLocation(program, 'u_resolution')
      const overlayTexLoc = gl.getUniformLocation(program, 'u_overlayTex')

      buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)

      textureLoader = loadTexture(gl, overlayTextureUrl)
      const overlayTexture = textureLoader.texture

      const startTime = performance.now() / 1000

      const render = () => {
        // Never touch a lost context: the resources have been invalidated by the browser.
        if (contextLost || gl.isContextLost()) return

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
    }

    const teardown = () => {
      cancelAnimationFrame(animFrameRef.current)
      // Stop the pending image load so its onload can't run GL on a deleted texture.
      textureLoader?.cancel()
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buffer)
      gl.deleteTexture(textureLoader?.texture ?? null)
    }

    const handleContextLost = (event: Event) => {
      // Prevent the default so the context becomes restorable, then stop rendering.
      event.preventDefault()
      contextLost = true
      cancelAnimationFrame(animFrameRef.current)
    }

    const handleContextRestored = () => {
      contextLost = false
      setup()
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    setup()

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      teardown()
      // Release the WebGL context so it doesn't count against the browser's live-context cap.
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return (
    <Wrapper variant={variant}>
      <Fallback variant={variant} aria-hidden />
      <Canvas ref={canvasRef} />
    </Wrapper>
  )
}

export { AnimatedBackground }
