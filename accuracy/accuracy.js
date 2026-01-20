// Touch Accuracy Test - Core Logic

const TOTAL_TAPS = 20
const TARGET_SIZE = 80
const PADDING = 40

// State
let state = 'start'
let taps = []
let currentTarget = null
let startTime = null

// DOM Elements
const startScreen = document.getElementById('start-screen')
const testScreen = document.getElementById('test-screen')
const resultsScreen = document.getElementById('results-screen')
const target = document.getElementById('target')
const tapCount = document.getElementById('tap-count')
const canvas = document.getElementById('results-canvas')
const ctx = canvas.getContext('2d')

// Toggle state
const toggleState = {
  heatmap: false,
  bias: false,
  quartiles: false
}

// Screen management
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen--active'))
  document.getElementById(screenId).classList.add('screen--active')
}

// Get random position with progressive edge targeting
function getRandomPosition(tapIndex) {
  const w = window.innerWidth
  const h = window.innerHeight
  const safeW = w - PADDING * 2
  const safeH = h - PADDING * 2

  let x, y

  // Progressive edge targeting
  const edgeChance = tapIndex < 10 ? 0 : tapIndex < 15 ? 0.5 : 0.7

  if (Math.random() < edgeChance) {
    // Target edge or corner
    const side = Math.floor(Math.random() * 4)
    const edgeDepth = 0.2 // outer 20% of screen

    switch (side) {
      case 0: // Top
        x = PADDING + Math.random() * safeW
        y = PADDING + Math.random() * safeH * edgeDepth
        break
      case 1: // Right
        x = w - PADDING - Math.random() * safeW * edgeDepth
        y = PADDING + Math.random() * safeH
        break
      case 2: // Bottom
        x = PADDING + Math.random() * safeW
        y = h - PADDING - Math.random() * safeH * edgeDepth
        break
      case 3: // Left
        x = PADDING + Math.random() * safeW * edgeDepth
        y = PADDING + Math.random() * safeH
        break
    }
  } else {
    // Random within safe area
    x = PADDING + Math.random() * safeW
    y = PADDING + Math.random() * safeH
  }

  return { x, y }
}

// Position target
function positionTarget() {
  const pos = getRandomPosition(taps.length)
  currentTarget = pos
  target.style.left = `${pos.x}px`
  target.style.top = `${pos.y}px`
  target.style.display = 'block'
}

// Start test
function startTest() {
  taps = []
  startTime = null
  state = 'testing'
  tapCount.textContent = '0'
  showScreen('test-screen')
  positionTarget()
}

// Record tap
function recordTap(touchX, touchY) {
  if (!currentTarget) return

  const now = Date.now()
  if (!startTime) startTime = now

  const dx = touchX - currentTarget.x
  const dy = touchY - currentTarget.y
  const error = Math.sqrt(dx * dx + dy * dy)

  taps.push({
    targetX: currentTarget.x,
    targetY: currentTarget.y,
    touchX,
    touchY,
    dx,
    dy,
    error,
    timestamp: now
  })

  tapCount.textContent = taps.length

  if (taps.length >= TOTAL_TAPS) {
    showResults()
  } else {
    positionTarget()
  }
}

// Calculate statistics
function calculateStats() {
  const errors = taps.map(t => t.error)
  const avgError = errors.reduce((a, b) => a + b, 0) / errors.length
  const maxError = Math.max(...errors)
  const totalTime = (taps[taps.length - 1].timestamp - startTime) / 1000
  const avgTime = totalTime / TOTAL_TAPS

  // Calculate bias (average dx and dy)
  const biasX = taps.reduce((a, t) => a + t.dx, 0) / taps.length
  const biasY = taps.reduce((a, t) => a + t.dy, 0) / taps.length
  const biasDistance = Math.sqrt(biasX * biasX + biasY * biasY)

  // Calculate quartiles
  const sorted = [...errors].sort((a, b) => a - b)
  const quartiles = {
    q25: sorted[Math.floor(sorted.length * 0.25)],
    q50: sorted[Math.floor(sorted.length * 0.50)],
    q75: sorted[Math.floor(sorted.length * 0.75)],
    q90: sorted[Math.floor(sorted.length * 0.90)]
  }

  return { avgError, maxError, totalTime, avgTime, biasX, biasY, biasDistance, quartiles }
}

// Draw visualization
function drawVisualization() {
  const stats = calculateStats()
  const size = Math.min(canvas.clientWidth, canvas.clientHeight)
  const dpr = window.devicePixelRatio || 1

  canvas.width = size * dpr
  canvas.height = size * dpr
  ctx.scale(dpr, dpr)

  const center = size / 2
  ctx.clearRect(0, 0, size, size)

  // Calculate zoom scale based on max error
  // We want the max error circle to fill about 40% of the canvas radius
  const targetRadius = size * 0.4
  const scale = Math.min(targetRadius / stats.maxError, 3) // Cap at 3x zoom

  // Helper to apply scale to distances
  const s = (distance) => distance * scale

  // Draw quartile rings if enabled - simplified to just 90% ring
  if (toggleState.quartiles) {
    ctx.strokeStyle = 'rgba(147, 51, 234, 0.4)'
    ctx.lineWidth = 2
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(center, center, s(stats.quartiles.q90), 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Label for 90% ring
    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(147, 51, 234, 0.8)'
    ctx.fillText(`90%: ${stats.quartiles.q90.toFixed(0)}px`, center + s(stats.quartiles.q90) + 6, center - 4)
  }

  // Draw heatmap if enabled
  if (toggleState.heatmap) {
    const heatSize = s(30)
    taps.forEach(tap => {
      const gradient = ctx.createRadialGradient(
        center + s(tap.dx), center + s(tap.dy), 0,
        center + s(tap.dx), center + s(tap.dy), heatSize
      )
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)')
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(center + s(tap.dx) - heatSize, center + s(tap.dy) - heatSize, heatSize * 2, heatSize * 2)
    })
  }

  // Draw center crosshair
  ctx.strokeStyle = '#e5e5e5'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(center - 10, center)
  ctx.lineTo(center + 10, center)
  ctx.moveTo(center, center - 10)
  ctx.lineTo(center, center + 10)
  ctx.stroke()

  // Draw max error circle (dashed)
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5])
  ctx.beginPath()
  ctx.arc(center, center, s(stats.maxError), 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Draw average error circle (solid)
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(center, center, s(stats.avgError), 0, Math.PI * 2)
  ctx.stroke()

  // Draw touch points
  taps.forEach(tap => {
    ctx.beginPath()
    ctx.arc(center + s(tap.dx), center + s(tap.dy), 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.6)'
    ctx.fill()
  })

  // Draw bias arrow if enabled - improved visibility
  if (toggleState.bias && stats.biasDistance > 2) {
    const biasScale = scale * 3 // Additional multiplier for arrow visibility
    const endX = center + stats.biasX * biasScale
    const endY = center + stats.biasY * biasScale

    // Draw arrow line with better contrast
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // Filled arrowhead
    const angle = Math.atan2(stats.biasY, stats.biasX)
    const headLen = 14
    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    ctx.moveTo(endX, endY)
    ctx.lineTo(
      endX - headLen * Math.cos(angle - Math.PI / 6),
      endY - headLen * Math.sin(angle - Math.PI / 6)
    )
    ctx.lineTo(
      endX - headLen * Math.cos(angle + Math.PI / 6),
      endY - headLen * Math.sin(angle + Math.PI / 6)
    )
    ctx.closePath()
    ctx.fill()

    // Bias label
    ctx.font = 'bold 11px sans-serif'
    ctx.fillStyle = '#dc2626'
    ctx.fillText(`Bias: ${stats.biasDistance.toFixed(1)}px`, endX + 8, endY + 4)
  }

  return stats
}

// Show results
function showResults() {
  state = 'results'
  target.style.display = 'none'
  showScreen('results-screen')

  const stats = drawVisualization()

  // Update stats display
  document.getElementById('avg-error').textContent = `${stats.avgError.toFixed(1)}px`
  document.getElementById('max-error').textContent = `${stats.maxError.toFixed(1)}px`
  document.getElementById('total-time').textContent = `${stats.totalTime.toFixed(1)}s`
  document.getElementById('avg-time').textContent = `${(stats.avgTime * 1000).toFixed(0)}ms`

  // Screen resolution
  const w = window.innerWidth
  const h = window.innerHeight
  const dpr = window.devicePixelRatio || 1
  document.getElementById('screen-resolution').textContent = `${w}×${h} @ ${dpr}x`

  // Quartiles display
  const quartilesEl = document.getElementById('quartiles-stats')
  if (quartilesEl) {
    quartilesEl.innerHTML = `
      <span class="quartile-item">25%: ${stats.quartiles.q25.toFixed(0)}px</span>
      <span class="quartile-item">50%: ${stats.quartiles.q50.toFixed(0)}px</span>
      <span class="quartile-item">75%: ${stats.quartiles.q75.toFixed(0)}px</span>
      <span class="quartile-item">90%: ${stats.quartiles.q90.toFixed(0)}px</span>
    `
  }
}

// Event handlers
function handleInteraction(x, y) {
  if (state === 'start') {
    startTest()
  } else if (state === 'testing') {
    recordTap(x, y)
  }
}

function handleClick(e) {
  handleInteraction(e.clientX, e.clientY)
}

function handleTouch(e) {
  e.preventDefault()
  const touch = e.touches[0]
  handleInteraction(touch.clientX, touch.clientY)
}

// Bind events
startScreen.addEventListener('click', handleClick)
startScreen.addEventListener('touchstart', handleTouch, { passive: false })

testScreen.addEventListener('click', handleClick)
testScreen.addEventListener('touchstart', handleTouch, { passive: false })

document.getElementById('restart-btn').addEventListener('click', () => {
  toggleState.heatmap = false
  toggleState.bias = false
  toggleState.quartiles = false
  document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('toggle-btn--active'))
  startTest()
})

// Toggle buttons
document.getElementById('toggle-heatmap').addEventListener('click', (e) => {
  toggleState.heatmap = !toggleState.heatmap
  e.target.classList.toggle('toggle-btn--active')
  drawVisualization()
})

document.getElementById('toggle-bias').addEventListener('click', (e) => {
  toggleState.bias = !toggleState.bias
  e.target.classList.toggle('toggle-btn--active')
  drawVisualization()
})

document.getElementById('toggle-quartiles').addEventListener('click', (e) => {
  toggleState.quartiles = !toggleState.quartiles
  e.target.classList.toggle('toggle-btn--active')
  document.getElementById('quartiles-stats').style.display = toggleState.quartiles ? 'flex' : 'none'
  drawVisualization()
})

// Handle resize
window.addEventListener('resize', () => {
  if (state === 'results') {
    drawVisualization()
  }
})
