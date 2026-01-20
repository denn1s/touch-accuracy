// Target Size Test - Core Logic

const TOTAL_TARGETS = 24
const TARGETS_PER_SIZE = 8
const SIZES = {
  small: 32,
  medium: 56,
  large: 80
}
const MISS_PENALTY_MS = 500
const PADDING = 50

// State
let state = 'start'
let targets = []
let currentTargetIndex = 0
let currentTarget = null
let startTime = null
let isLocked = false

// Per-target tracking
let targetData = []

// DOM Elements
const startScreen = document.getElementById('start-screen')
const testScreen = document.getElementById('test-screen')
const resultsScreen = document.getElementById('results-screen')
const target = document.getElementById('target')
const tapCount = document.getElementById('tap-count')
const flashOverlay = document.getElementById('flash-overlay')
const chartCanvas = document.getElementById('chart-canvas')
const chartCtx = chartCanvas.getContext('2d')

// Generate randomized target list
function generateTargets() {
  const list = []

  // Add 8 of each size
  for (const [sizeName, sizeValue] of Object.entries(SIZES)) {
    for (let i = 0; i < TARGETS_PER_SIZE; i++) {
      list.push({ size: sizeName, diameter: sizeValue })
    }
  }

  // Shuffle using Fisher-Yates
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }

  return list
}

// Screen management
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen--active'))
  document.getElementById(screenId).classList.add('screen--active')
}

// Get random position with progressive edge targeting (same as accuracy tool)
function getRandomPosition(tapIndex, diameter) {
  const w = window.innerWidth
  const h = window.innerHeight
  const pad = PADDING + diameter / 2
  const safeW = w - pad * 2
  const safeH = h - pad * 2

  let x, y

  // Progressive edge targeting
  const edgeChance = tapIndex < 10 ? 0 : tapIndex < 18 ? 0.5 : 0.7

  if (Math.random() < edgeChance) {
    const side = Math.floor(Math.random() * 4)
    const edgeDepth = 0.2

    switch (side) {
      case 0: // Top
        x = pad + Math.random() * safeW
        y = pad + Math.random() * safeH * edgeDepth
        break
      case 1: // Right
        x = w - pad - Math.random() * safeW * edgeDepth
        y = pad + Math.random() * safeH
        break
      case 2: // Bottom
        x = pad + Math.random() * safeW
        y = h - pad - Math.random() * safeH * edgeDepth
        break
      case 3: // Left
        x = pad + Math.random() * safeW * edgeDepth
        y = pad + Math.random() * safeH
        break
    }
  } else {
    x = pad + Math.random() * safeW
    y = pad + Math.random() * safeH
  }

  return { x, y }
}

// Position target
function positionTarget() {
  const targetInfo = targets[currentTargetIndex]
  const pos = getRandomPosition(currentTargetIndex, targetInfo.diameter)

  currentTarget = {
    ...targetInfo,
    x: pos.x,
    y: pos.y,
    startTime: Date.now(),
    misses: 0
  }

  target.style.left = `${pos.x}px`
  target.style.top = `${pos.y}px`
  target.style.width = `${targetInfo.diameter}px`
  target.style.height = `${targetInfo.diameter}px`
  target.style.display = 'block'
}

// Flash feedback
function flash(type, duration = 150) {
  flashOverlay.className = 'flash-overlay'
  // Force reflow
  void flashOverlay.offsetWidth
  flashOverlay.classList.add(`flash-overlay--${type}`)

  setTimeout(() => {
    flashOverlay.className = 'flash-overlay'
  }, duration)
}

// Check if touch is inside target
function isHit(touchX, touchY) {
  const dx = touchX - currentTarget.x
  const dy = touchY - currentTarget.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  return distance <= currentTarget.diameter / 2
}

// Start test
function startTest() {
  targets = generateTargets()
  targetData = []
  currentTargetIndex = 0
  startTime = null
  state = 'testing'
  isLocked = false
  tapCount.textContent = '0'
  showScreen('test-screen')
  positionTarget()
}

// Handle tap on test screen
function handleTap(touchX, touchY) {
  if (!currentTarget || isLocked) return

  const now = Date.now()
  if (!startTime) startTime = now

  if (isHit(touchX, touchY)) {
    // Success!
    flash('hit')

    // Record target data
    targetData.push({
      size: currentTarget.size,
      diameter: currentTarget.diameter,
      misses: currentTarget.misses,
      timeToHit: now - currentTarget.startTime
    })

    currentTargetIndex++
    tapCount.textContent = currentTargetIndex

    if (currentTargetIndex >= TOTAL_TARGETS) {
      showResults()
    } else {
      positionTarget()
    }
  } else {
    // Miss!
    flash('miss', MISS_PENALTY_MS)
    currentTarget.misses++
    isLocked = true

    setTimeout(() => {
      isLocked = false
    }, MISS_PENALTY_MS)
  }
}

// Calculate statistics
function calculateStats() {
  const totalMisses = targetData.reduce((sum, t) => sum + t.misses, 0)
  const totalAttempts = TOTAL_TARGETS + totalMisses
  const overallAccuracy = (TOTAL_TARGETS / totalAttempts) * 100
  const totalTime = (targetData[targetData.length - 1].timeToHit +
    targetData.slice(0, -1).reduce((sum, t) => sum + t.timeToHit, 0)) / 1000

  // Per-size stats
  const bySize = {}
  for (const sizeName of Object.keys(SIZES)) {
    const sizeTargets = targetData.filter(t => t.size === sizeName)
    const sizeMisses = sizeTargets.reduce((sum, t) => sum + t.misses, 0)
    const sizeAttempts = sizeTargets.length + sizeMisses
    const avgTime = sizeTargets.reduce((sum, t) => sum + t.timeToHit, 0) / sizeTargets.length

    bySize[sizeName] = {
      hits: sizeTargets.length,
      misses: sizeMisses,
      attempts: sizeAttempts,
      accuracy: (sizeTargets.length / sizeAttempts) * 100,
      avgTime
    }
  }

  return { totalMisses, totalAttempts, overallAccuracy, totalTime, bySize }
}

// Draw bar chart
function drawChart(stats) {
  const width = chartCanvas.clientWidth
  const height = chartCanvas.clientHeight
  const dpr = window.devicePixelRatio || 1

  chartCanvas.width = width * dpr
  chartCanvas.height = height * dpr
  chartCtx.scale(dpr, dpr)

  chartCtx.clearRect(0, 0, width, height)

  const sizes = ['small', 'medium', 'large']
  const colors = ['#ef4444', '#f59e0b', '#22c55e']
  const barWidth = 50
  const gap = (width - barWidth * 3) / 4
  const maxMisses = Math.max(
    stats.bySize.small.misses,
    stats.bySize.medium.misses,
    stats.bySize.large.misses,
    1
  )

  sizes.forEach((size, i) => {
    const x = gap + i * (barWidth + gap)
    const missRate = stats.bySize[size].misses
    const barHeight = (missRate / maxMisses) * (height - 40)

    // Bar
    chartCtx.fillStyle = colors[i]
    chartCtx.fillRect(x, height - 20 - barHeight, barWidth, barHeight)

    // Label
    chartCtx.fillStyle = '#666'
    chartCtx.font = '12px sans-serif'
    chartCtx.textAlign = 'center'
    chartCtx.fillText(size.charAt(0).toUpperCase() + size.slice(1), x + barWidth / 2, height - 4)

    // Value on top of bar
    chartCtx.fillStyle = '#333'
    chartCtx.font = 'bold 14px sans-serif'
    chartCtx.fillText(missRate.toString(), x + barWidth / 2, height - 26 - barHeight)
  })

  // Y-axis label
  chartCtx.save()
  chartCtx.translate(12, height / 2)
  chartCtx.rotate(-Math.PI / 2)
  chartCtx.fillStyle = '#999'
  chartCtx.font = '11px sans-serif'
  chartCtx.textAlign = 'center'
  chartCtx.fillText('Misses', 0, 0)
  chartCtx.restore()
}

// Show results
function showResults() {
  state = 'results'
  target.style.display = 'none'
  showScreen('results-screen')

  const stats = calculateStats()

  // Update overall stats
  document.getElementById('total-hits').textContent = TOTAL_TARGETS
  document.getElementById('total-misses').textContent = stats.totalMisses
  document.getElementById('overall-accuracy').textContent = `${stats.overallAccuracy.toFixed(0)}%`
  document.getElementById('total-time').textContent = `${stats.totalTime.toFixed(1)}s`

  // Update per-size stats
  for (const size of ['small', 'medium', 'large']) {
    const s = stats.bySize[size]
    document.getElementById(`${size}-misses`).textContent = `${s.misses} misses`
    document.getElementById(`${size}-accuracy`).textContent = `${s.accuracy.toFixed(0)}% accuracy`
    document.getElementById(`${size}-time`).textContent = `${(s.avgTime / 1000).toFixed(2)}s avg`
  }

  drawChart(stats)
}

// Event handlers
function handleInteraction(x, y) {
  if (state === 'start') {
    startTest()
  } else if (state === 'testing') {
    handleTap(x, y)
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
  startTest()
})

// Handle resize
window.addEventListener('resize', () => {
  if (state === 'results') {
    const stats = calculateStats()
    drawChart(stats)
  }
})
