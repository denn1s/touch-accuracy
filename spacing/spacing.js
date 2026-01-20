// Target Spacing Test - Core Logic

const TRIALS_PER_CONFIG = 5
const MISS_PENALTY_MS = 1000
const SIZES = { large: 80, medium: 56, small: 32 }
const SPACING = { spaced: 16, tight: 0 }
const COLORS = ['orange', 'purple', 'cyan']

// Test configurations in order
const CONFIGS = [
  { size: 'large', spacing: 'spaced', label: 'Large' },
  { size: 'large', spacing: 'tight', label: 'Large + Tight' },
  { size: 'medium', spacing: 'spaced', label: 'Medium' },
  { size: 'medium', spacing: 'tight', label: 'Medium + Tight' },
  { size: 'small', spacing: 'spaced', label: 'Small' },
  { size: 'small', spacing: 'tight', label: 'Small + Tight' }
]

const TOTAL_TRIALS = CONFIGS.length * TRIALS_PER_CONFIG

// State
let state = 'start'
let currentConfigIndex = 0
let currentTrialInConfig = 0
let currentTargetColor = null
let startTime = null
let isLocked = false

// Per-config tracking
let configData = {}

// DOM Elements
const startScreen = document.getElementById('start-screen')
const testScreen = document.getElementById('test-screen')
const resultsScreen = document.getElementById('results-screen')
const tapCount = document.getElementById('tap-count')
const colorPrompt = document.getElementById('color-prompt')
const configInfo = document.getElementById('config-info')
const targetsContainer = document.getElementById('targets-container')
const targets = [
  document.getElementById('target-0'),
  document.getElementById('target-1'),
  document.getElementById('target-2')
]
const flashOverlay = document.getElementById('flash-overlay')
const chartCanvas = document.getElementById('chart-canvas')
const chartCtx = chartCanvas.getContext('2d')

// Initialize config data
function initConfigData() {
  configData = {}
  CONFIGS.forEach(config => {
    configData[config.label] = {
      hits: 0,
      errors: 0,
      totalTime: 0
    }
  })
}

// Screen management
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen--active'))
  document.getElementById(screenId).classList.add('screen--active')
}

// Shuffle array (Fisher-Yates)
function shuffle(arr) {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Setup targets for current config
function setupTargets() {
  const config = CONFIGS[currentConfigIndex]
  const diameter = SIZES[config.size]
  const gap = SPACING[config.spacing]

  // Shuffle colors for target positions
  const shuffledColors = shuffle(COLORS)

  targets.forEach((target, i) => {
    target.style.width = `${diameter}px`
    target.style.height = `${diameter}px`
    target.style.marginLeft = i === 0 ? '0' : `${gap}px`
    target.className = `target target--${shuffledColors[i]}`
    target.dataset.color = shuffledColors[i]
  })

  // Pick random target color to request
  currentTargetColor = shuffledColors[Math.floor(Math.random() * 3)]

  // Update prompt
  colorPrompt.className = `color-prompt color-prompt--${currentTargetColor}`

  // Update config label
  configInfo.textContent = `${config.label}`
}

// Flash feedback
function flash(type, duration = 150) {
  flashOverlay.className = 'flash-overlay'
  void flashOverlay.offsetWidth
  flashOverlay.classList.add(`flash-overlay--${type}`)

  setTimeout(() => {
    flashOverlay.className = 'flash-overlay'
  }, duration)
}

// Start test
function startTest() {
  initConfigData()
  currentConfigIndex = 0
  currentTrialInConfig = 0
  startTime = Date.now()
  state = 'testing'
  isLocked = false
  tapCount.textContent = '0'
  showScreen('test-screen')
  setupTargets()
}

// Get current trial number (1-indexed)
function getCurrentTrialNumber() {
  return currentConfigIndex * TRIALS_PER_CONFIG + currentTrialInConfig + 1
}

// Handle target tap
function handleTargetTap(tappedColor) {
  if (isLocked) return

  const config = CONFIGS[currentConfigIndex]

  if (tappedColor === currentTargetColor) {
    // Correct!
    isLocked = true // Lock briefly to prevent double-taps during DOM update
    flash('hit')
    configData[config.label].hits++

    // Update progress
    tapCount.textContent = getCurrentTrialNumber()

    // Advance
    currentTrialInConfig++

    if (currentTrialInConfig >= TRIALS_PER_CONFIG) {
      // Move to next config
      currentTrialInConfig = 0
      currentConfigIndex++

      if (currentConfigIndex >= CONFIGS.length) {
        // Test complete
        showResults()
        return
      }
    }

    setupTargets()

    // Unlock after a brief delay to allow DOM to update
    setTimeout(() => {
      isLocked = false
    }, 50)
  } else {
    // Wrong target!
    flash('miss', MISS_PENALTY_MS)
    configData[config.label].errors++
    isLocked = true

    setTimeout(() => {
      isLocked = false
    }, MISS_PENALTY_MS)
  }
}

// Calculate stats
function calculateStats() {
  let totalErrors = 0
  let totalHits = 0

  CONFIGS.forEach(config => {
    const data = configData[config.label]
    totalErrors += data.errors
    totalHits += data.hits
  })

  const totalAttempts = totalHits + totalErrors
  const overallAccuracy = (totalHits / totalAttempts) * 100
  const totalTime = (Date.now() - startTime) / 1000

  return { totalErrors, totalHits, totalAttempts, overallAccuracy, totalTime }
}

// Draw bar chart
function drawChart() {
  const width = chartCanvas.clientWidth
  const height = chartCanvas.clientHeight
  const dpr = window.devicePixelRatio || 1

  chartCanvas.width = width * dpr
  chartCanvas.height = height * dpr
  chartCtx.scale(dpr, dpr)

  chartCtx.clearRect(0, 0, width, height)

  const barWidth = 40
  const groupGap = 30
  const barGap = 4
  const groupWidth = barWidth * 2 + barGap
  const totalWidth = groupWidth * 3 + groupGap * 2
  const startX = (width - totalWidth) / 2

  const maxErrors = Math.max(
    ...CONFIGS.map(c => configData[c.label].errors),
    1
  )

  const sizes = ['large', 'medium', 'small']
  const sizeLabels = ['Large', 'Medium', 'Small']
  const colors = { spaced: '#22c55e', tight: '#ef4444' }

  sizes.forEach((size, groupIndex) => {
    const groupX = startX + groupIndex * (groupWidth + groupGap)

    // Spaced bar
    const spacedConfig = CONFIGS.find(c => c.size === size && c.spacing === 'spaced')
    const spacedErrors = configData[spacedConfig.label].errors
    const spacedHeight = (spacedErrors / maxErrors) * (height - 50)

    chartCtx.fillStyle = colors.spaced
    chartCtx.fillRect(groupX, height - 25 - spacedHeight, barWidth, spacedHeight)

    // Value
    chartCtx.fillStyle = '#333'
    chartCtx.font = 'bold 12px sans-serif'
    chartCtx.textAlign = 'center'
    chartCtx.fillText(spacedErrors.toString(), groupX + barWidth / 2, height - 30 - spacedHeight)

    // Tight bar
    const tightConfig = CONFIGS.find(c => c.size === size && c.spacing === 'tight')
    const tightErrors = configData[tightConfig.label].errors
    const tightHeight = (tightErrors / maxErrors) * (height - 50)

    chartCtx.fillStyle = colors.tight
    chartCtx.fillRect(groupX + barWidth + barGap, height - 25 - tightHeight, barWidth, tightHeight)

    // Value
    chartCtx.fillText(tightErrors.toString(), groupX + barWidth + barGap + barWidth / 2, height - 30 - tightHeight)

    // Size label
    chartCtx.fillStyle = '#666'
    chartCtx.font = '11px sans-serif'
    chartCtx.fillText(sizeLabels[groupIndex], groupX + groupWidth / 2, height - 6)
  })

  // Legend
  chartCtx.fillStyle = colors.spaced
  chartCtx.fillRect(10, 8, 12, 12)
  chartCtx.fillStyle = '#666'
  chartCtx.font = '10px sans-serif'
  chartCtx.textAlign = 'left'
  chartCtx.fillText('Spaced', 26, 17)

  chartCtx.fillStyle = colors.tight
  chartCtx.fillRect(70, 8, 12, 12)
  chartCtx.fillStyle = '#666'
  chartCtx.fillText('Tight', 86, 17)
}

// Show results
function showResults() {
  state = 'results'
  showScreen('results-screen')

  const stats = calculateStats()

  // Update overall stats
  document.getElementById('total-correct').textContent = stats.totalHits
  document.getElementById('total-errors').textContent = stats.totalErrors
  document.getElementById('overall-accuracy').textContent = `${stats.overallAccuracy.toFixed(0)}%`
  document.getElementById('total-time').textContent = `${stats.totalTime.toFixed(1)}s`

  // Build config stats
  const configStatsEl = document.getElementById('config-stats')
  configStatsEl.innerHTML = ''

  CONFIGS.forEach(config => {
    const data = configData[config.label]
    const div = document.createElement('div')
    div.className = `config-stat config-stat--${config.spacing}`
    div.innerHTML = `
      <span class="config-name">${config.label}</span>
      <span class="config-errors">${data.errors} errors</span>
    `
    configStatsEl.appendChild(div)
  })

  drawChart()
}

// Event handlers
function handleClick(e) {
  if (state === 'start') {
    startTest()
  }
}

function handleTouch(e) {
  e.preventDefault()
  if (state === 'start') {
    startTest()
  }
}

// Bind events
startScreen.addEventListener('click', handleClick)
startScreen.addEventListener('touchstart', handleTouch, { passive: false })

// Target click handlers
targets.forEach(target => {
  target.addEventListener('click', (e) => {
    e.stopPropagation()
    if (state === 'testing') {
      handleTargetTap(target.dataset.color)
    }
  })

  target.addEventListener('touchstart', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (state === 'testing') {
      handleTargetTap(target.dataset.color)
    }
  }, { passive: false })
})

// Restart button
document.getElementById('restart-btn').addEventListener('click', () => {
  startTest()
})

// Handle resize
window.addEventListener('resize', () => {
  if (state === 'results') {
    drawChart()
  }
})
