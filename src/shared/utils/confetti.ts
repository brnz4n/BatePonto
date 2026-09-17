/**
 * Gerador leve de confetes em Canvas nativo para feedback visual de sucesso
 * Zero dependências externas, alta performance em mobile.
 */
export function triggerConfetti() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '9999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const colors = ['#722F37', '#8C3843', '#10B981', '#E2E8F0', '#0A192F', '#F59E0B']
  const particleCount = 45

  const particles = Array.from({ length: particleCount }).map(() => ({
    x: canvas.width / 2 + (Math.random() * 80 - 40),
    y: canvas.height * 0.75,
    vx: (Math.random() - 0.5) * 12,
    vy: -(Math.random() * 14 + 10),
    size: Math.random() * 7 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    alpha: 1,
  }))

  let animationFrameId: number

  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let activeCount = 0

    particles.forEach((p) => {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.45 // Gravidade
      p.vx *= 0.98 // Resistência do ar
      p.rotation += p.rotationSpeed
      p.alpha -= 0.015

      if (p.alpha > 0) {
        activeCount++
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
    })

    if (activeCount > 0) {
      animationFrameId = requestAnimationFrame(render)
    } else {
      cancelAnimationFrame(animationFrameId)
      canvas.remove()
    }
  }

  render()
}
