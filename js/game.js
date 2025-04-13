// Game variables
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const scoreElement = document.getElementById('score');
const totalScoreElement = document.getElementById('totalScore'); // New total score element
const levelElement = document.getElementById('level');
const lanesElement = document.getElementById('lanes');
const controlTypeRadios = document.querySelectorAll('input[name="controlType"]');

// Powerup elements
const shieldBtn = document.getElementById('shieldBtn');
const slowMotionBtn = document.getElementById('slowMotionBtn');
const magnetBtn = document.getElementById('magnetBtn');
const shieldCountElement = document.getElementById('shieldCount');
const slowMotionCountElement = document.getElementById('slowMotionCount');
const magnetCountElement = document.getElementById('magnetCount');
const activePowerupsElement = document.getElementById('activePowerups');

// Set canvas dimensions
canvas.width = 1200;
canvas.height = 800;

// Game state
let gameRunning = false;
let gameOver = false;
let score = 0;
let totalScore = 0; // Total score accumulated across games
let level = 1;
let animationId;
let roadSpeed = 5;
let obstacleSpeed = 5;
let spawnRate = 0.02; // Chance of spawning an obstacle each frame
let lastFrameTime = 0;
let numLanes = 3; // Starting number of lanes
let controlType = 'keyboard'; // Default control type
let mouseX = 0;
let mouseY = 0;
let mouseCursor = {
    x: 0,
    y: 0,
    visible: false
};

// Powerups state
const powerups = {
    shield: {
        count: 0,
        active: false,
        duration: 0,
        cost: 100,
        maxDuration: 10000 // 10 seconds
    },
    slowMotion: {
        count: 0,
        active: false,
        duration: 0,
        cost: 200,
        maxDuration: 8000, // 8 seconds
        speedFactor: 0.5 // How much to slow obstacles
    },
    magnet: {
        count: 0,
        active: false,
        duration: 0,
        cost: 300,
        maxDuration: 15000, // 15 seconds
        range: 150 // Range to attract points
    }
};

// Point items
let pointItems = [];

// Car properties
const car = {
    x: canvas.width / 2 - 40,
    y: canvas.height - 180,
    width: 80,
    height: 140,
    speed: 6,
    color: 'red',
    shieldActive: false
};

// Road properties
let roadOffset = 0;
let laneWidth = canvas.width / numLanes;

// Key states for smooth controls
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false
};

// Obstacles array
let obstacles = [];

// Event listeners for controls
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
    
    // Use number keys 1-3 to activate powerups quickly during gameplay
    if (gameRunning && !gameOver) {
        if (e.key === '1' && powerups.shield.count > 0) {
            activateShield();
        } else if (e.key === '2' && powerups.slowMotion.count > 0) {
            activateSlowMotion();
        } else if (e.key === '3' && powerups.magnet.count > 0) {
            activateMagnet();
        }
    }
    
    // Use z, x, c keys to buy powerups between games
    if (!gameRunning) {
        if (e.key === 'z' && totalScore >= powerups.shield.cost) {
            purchasePowerup('shield');
        } else if (e.key === 'x' && totalScore >= powerups.slowMotion.cost) {
            purchasePowerup('slowMotion');
        } else if (e.key === 'c' && totalScore >= powerups.magnet.cost) {
            purchasePowerup('magnet');
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// Mouse move event listener
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    // Update mouse cursor position
    mouseCursor.x = mouseX;
    mouseCursor.y = mouseY;
    mouseCursor.visible = true;
});

// Mouse enter/leave events to show/hide cursor
canvas.addEventListener('mouseenter', () => {
    mouseCursor.visible = true;
});

canvas.addEventListener('mouseleave', () => {
    mouseCursor.visible = false;
});

// Control type change event listener
controlTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        controlType = e.target.value;
        if (controlType === 'mouse') {
            canvas.style.cursor = 'none'; // Hide default cursor in mouse control mode
        } else {
            canvas.style.cursor = 'auto'; // Show default cursor in keyboard mode
        }
    });
});

// Start button event listener
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', restartGame);

// Powerup activation functions
function activateShield() {
    if (powerups.shield.count > 0 && !powerups.shield.active) {
        powerups.shield.count--;
        powerups.shield.active = true;
        powerups.shield.duration = powerups.shield.maxDuration;
        shieldCountElement.textContent = powerups.shield.count;
        updatePowerupButtons();
        updateActivePowerupsDisplay();
        
        // Visual feedback - car gets blue shield
        car.shieldActive = true;
    }
}

function activateSlowMotion() {
    if (powerups.slowMotion.count > 0 && !powerups.slowMotion.active) {
        powerups.slowMotion.count--;
        powerups.slowMotion.active = true;
        powerups.slowMotion.duration = powerups.slowMotion.maxDuration;
        slowMotionCountElement.textContent = powerups.slowMotion.count;
        updatePowerupButtons();
        updateActivePowerupsDisplay();
        
        // Store original speed
        powerups.slowMotion.originalSpeed = obstacleSpeed;
        
        // Slow down obstacles
        obstacleSpeed *= powerups.slowMotion.speedFactor;
    }
}

function activateMagnet() {
    if (powerups.magnet.count > 0 && !powerups.magnet.active) {
        powerups.magnet.count--;
        powerups.magnet.active = true;
        powerups.magnet.duration = powerups.magnet.maxDuration;
        magnetCountElement.textContent = powerups.magnet.count;
        updatePowerupButtons();
        updateActivePowerupsDisplay();
    }
}

// Update powerup buttons based on availability
function updatePowerupButtons() {
    // In game - can only use powerups, not buy them
    if (gameRunning) {
        shieldBtn.disabled = powerups.shield.count === 0 || powerups.shield.active;
        slowMotionBtn.disabled = powerups.slowMotion.count === 0 || powerups.slowMotion.active;
        magnetBtn.disabled = powerups.magnet.count === 0 || powerups.magnet.active;
    } 
    // Between games - can buy powerups with total accumulated score
    else {
        shieldBtn.disabled = totalScore < powerups.shield.cost;
        slowMotionBtn.disabled = totalScore < powerups.slowMotion.cost;
        magnetBtn.disabled = totalScore < powerups.magnet.cost;
    }
}

// Update the display of active powerups
function updateActivePowerupsDisplay() {
    activePowerupsElement.innerHTML = '';
    
    if (powerups.shield.active) {
        const shieldIndicator = document.createElement('span');
        shieldIndicator.className = 'active-powerup shield-active';
        shieldIndicator.textContent = 'Shield';
        activePowerupsElement.appendChild(shieldIndicator);
    }
    
    if (powerups.slowMotion.active) {
        const slowIndicator = document.createElement('span');
        slowIndicator.className = 'active-powerup slow-active';
        slowIndicator.textContent = 'Slow Mo';
        activePowerupsElement.appendChild(slowIndicator);
    }
    
    if (powerups.magnet.active) {
        const magnetIndicator = document.createElement('span');
        magnetIndicator.className = 'active-powerup magnet-active';
        magnetIndicator.textContent = 'Magnet';
        activePowerupsElement.appendChild(magnetIndicator);
    }
}

// Purchase powerup functions
function purchasePowerup(type) {
    const powerup = powerups[type];
    
    if (totalScore >= powerup.cost) {
        totalScore -= powerup.cost;
        powerup.count++;
        
        // Update count display
        if (type === 'shield') {
            shieldCountElement.textContent = powerup.count;
        } else if (type === 'slowMotion') {
            slowMotionCountElement.textContent = powerup.count;
        } else if (type === 'magnet') {
            magnetCountElement.textContent = powerup.count;
        }
        
        // Update the score display
        totalScoreElement.textContent = totalScore; // Update total score element
        updatePowerupButtons();
    }
}

// Game functions
function startGame() {
    if (!gameRunning) {
        gameRunning = true;
        gameOver = false;
        
        // Reset current game score
        score = 0;
        
        level = 1;
        roadSpeed = 5;
        obstacleSpeed = 5;
        spawnRate = 0.02;
        numLanes = 3;
        laneWidth = canvas.width / numLanes;
        pointItems = [];
        
        // In game, we display the current game's score
        scoreElement.textContent = score;
        levelElement.textContent = level;
        lanesElement.textContent = numLanes;
        
        obstacles = [];
        startButton.style.display = 'none';
        restartButton.style.display = 'none';
        
        // Update powerup buttons to reflect that we're now in game
        updatePowerupButtons();
        
        requestAnimationFrame(gameLoop);
    }
}

function restartGame() {
    gameRunning = false;
    gameOver = false;
    car.x = canvas.width / 2 - 40;
    car.y = canvas.height - 180;
    car.shieldActive = false;
    
    // Reset active powerups
    powerups.shield.active = false;
    powerups.slowMotion.active = false;
    powerups.magnet.active = false;
    
    // Clear active powerups display
    activePowerupsElement.innerHTML = '';
    
    // Show total accumulated score for purchasing powerups
    totalScoreElement.textContent = totalScore; // Update total score element
    
    // Update powerup buttons to reflect we're between games
    updatePowerupButtons();
    
    // Make sure buttons are visible
    startButton.style.display = 'inline-block';
    restartButton.style.display = 'none';
}

function gameLoop(timestamp) {
    // Calculate delta time for frame-rate independent movement
    const deltaTime = timestamp - lastFrameTime || 0;
    lastFrameTime = timestamp;
    
    if (gameRunning && !gameOver) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update road
        updateRoad();
        
        // Update powerups duration
        updatePowerupsDuration(deltaTime);
        
        // Update car position based on control type
        if (controlType === 'keyboard') {
            updateCarPositionKeyboard();
        } else if (controlType === 'mouse') {
            updateCarPositionMouse();
        }
        
        // Update obstacles
        updateObstacles(deltaTime);
        
        // Update point items
        updatePointItems(deltaTime);
        
        // Occasionally spawn point items
        if (Math.random() < 0.005) {
            spawnPointItem();
        }
        
        // Check for collisions
        checkCollisions();
        
        // Draw mouse cursor if in mouse mode
        if (controlType === 'mouse' && mouseCursor.visible) {
            drawMouseCursor();
        }
        
        // Next animation frame
        animationId = requestAnimationFrame(gameLoop);
    } else if (gameOver) {
        showGameOver();
    }
}

function updatePowerupsDuration(deltaTime) {
    // Update shield powerup
    if (powerups.shield.active) {
        powerups.shield.duration -= deltaTime;
        if (powerups.shield.duration <= 0) {
            powerups.shield.active = false;
            car.shieldActive = false;
            updateActivePowerupsDisplay();
        }
    }
    
    // Update slow motion powerup
    if (powerups.slowMotion.active) {
        powerups.slowMotion.duration -= deltaTime;
        if (powerups.slowMotion.duration <= 0) {
            powerups.slowMotion.active = false;
            // Restore original speed
            obstacleSpeed = powerups.slowMotion.originalSpeed;
            updateActivePowerupsDisplay();
        }
    }
    
    // Update magnet powerup
    if (powerups.magnet.active) {
        powerups.magnet.duration -= deltaTime;
        if (powerups.magnet.duration <= 0) {
            powerups.magnet.active = false;
            updateActivePowerupsDisplay();
        }
    }
    
    // Update powerup buttons state
    updatePowerupButtons();
}

function updateRoad() {
    // Draw road
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw lane dividers
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 5;
    ctx.setLineDash([40, 30]);
    
    roadOffset = (roadOffset + roadSpeed) % 70; // Move the road lines
    
    // Draw lane dividers based on the current number of lanes
    for (let i = 1; i < numLanes; i++) {
        const xPosition = i * laneWidth;
        ctx.beginPath();
        ctx.moveTo(xPosition, -roadOffset);
        ctx.lineTo(xPosition, canvas.height);
        ctx.stroke();
    }
    
    // Reset line dash
    ctx.setLineDash([]);
}

function updateCarPositionKeyboard() {
    // Update car position based on key states
    if (keys.ArrowLeft && car.x > 0) {
        car.x -= car.speed;
    }
    
    if (keys.ArrowRight && car.x < canvas.width - car.width) {
        car.x += car.speed;
    }
    
    if (keys.ArrowUp && car.y > 0) {
        car.y -= car.speed;
    }
    
    if (keys.ArrowDown && car.y < canvas.height - car.height) {
        car.y += car.speed;
    }
    
    // Draw car
    drawCar();
}

function updateCarPositionMouse() {
    // Calculate target position (center car on mouse)
    const targetX = mouseX - (car.width / 2);
    const targetY = mouseY - (car.height / 2);
    
    // Apply smooth movement towards mouse position
    const easing = 0.1; // Lower for slower, smoother movement
    
    car.x += (targetX - car.x) * easing;
    car.y += (targetY - car.y) * easing;
    
    // Keep car within boundaries
    car.x = Math.max(0, Math.min(car.x, canvas.width - car.width));
    car.y = Math.max(0, Math.min(car.y, canvas.height - car.height));
    
    // Draw car
    drawCar();
}

function drawCar() {
    // Draw car body
    ctx.fillStyle = car.color;
    ctx.fillRect(car.x, car.y, car.width, car.height);
    
    // Draw car details to make it look more like a car
    ctx.fillStyle = '#000';
    
    // Windows
    ctx.fillRect(car.x + 10, car.y + 15, car.width - 20, 25);
    
    // Wheels
    ctx.fillRect(car.x - 5, car.y + 10, 10, 25);
    ctx.fillRect(car.x - 5, car.y + car.height - 35, 10, 25);
    ctx.fillRect(car.x + car.width - 5, car.y + 10, 10, 25);
    ctx.fillRect(car.x + car.width - 5, car.y + car.height - 35, 10, 25);
    
    // Draw shield if active
    if (car.shieldActive) {
        ctx.strokeStyle = 'rgba(0, 128, 255, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.rect(car.x - 5, car.y - 5, car.width + 10, car.height + 10);
        ctx.stroke();
        
        // Add glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0, 128, 255, 0.7)';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

function drawMouseCursor() {
    // Draw a custom cursor when using mouse controls
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(mouseCursor.x, mouseCursor.y, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw crosshair
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mouseCursor.x - 10, mouseCursor.y);
    ctx.lineTo(mouseCursor.x + 10, mouseCursor.y);
    ctx.moveTo(mouseCursor.x, mouseCursor.y - 10);
    ctx.lineTo(mouseCursor.x, mouseCursor.y + 10);
    ctx.stroke();
}

function spawnPointItem() {
    const pointItemSize = 30;
    const x = Math.random() * (canvas.width - pointItemSize);
    
    pointItems.push({
        x: x,
        y: -pointItemSize,
        width: pointItemSize,
        height: pointItemSize,
        value: 25,
        speed: obstacleSpeed * 0.8,
        type: 'coin'
    });
}

function updatePointItems(deltaTime) {
    const carCenterX = car.x + car.width / 2;
    const carCenterY = car.y + car.height / 2;
    
    for (let i = 0; i < pointItems.length; i++) {
        const item = pointItems[i];
        
        // Apply magnet effect if active
        if (powerups.magnet.active) {
            const dx = carCenterX - (item.x + item.width / 2);
            const dy = carCenterY - (item.y + item.height / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < powerups.magnet.range) {
                // Move towards car with stronger attraction as it gets closer
                const attractionStrength = 1 - (distance / powerups.magnet.range);
                item.x += dx * 0.1 * attractionStrength;
                item.y += dy * 0.1 * attractionStrength;
            } else {
                // Normal downward movement
                item.y += item.speed;
            }
        } else {
            // Normal downward movement
            item.y += item.speed;
        }
        
        // Draw point item (coin)
        ctx.fillStyle = 'gold';
        ctx.beginPath();
        ctx.arc(item.x + item.width / 2, item.y + item.height / 2, item.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Add shiny effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(item.x + item.width / 2 - 5, item.y + item.height / 2 - 5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Check for collection
        if (
            car.x < item.x + item.width &&
            car.x + car.width > item.x &&
            car.y < item.y + item.height &&
            car.y + car.height > item.y
        ) {
            // Collect point item
            score += item.value;
            totalScore += item.value;
            scoreElement.textContent = score;
            totalScoreElement.textContent = totalScore; // Update total score element
            
            // Remove collected item
            pointItems.splice(i, 1);
            i--;
            
            continue;
        }
        
        // Remove items that are off screen
        if (item.y > canvas.height) {
            pointItems.splice(i, 1);
            i--;
        }
    }
}

function updateObstacles(deltaTime) {
    // Spawn new obstacles
    if (Math.random() < spawnRate) {
        // Random x position across the entire road instead of fixed lanes
        const obstacleWidth = 50;
        const obstacleX = Math.random() * (canvas.width - obstacleWidth);
        
        obstacles.push({
            x: obstacleX,
            y: -100, // Start above the visible canvas
            width: obstacleWidth,
            height: 80,
            color: getRandomColor()
        });
    }
    
    // Update and draw obstacles
    for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].y += obstacleSpeed;
        
        // Draw obstacle
        ctx.fillStyle = obstacles[i].color;
        ctx.fillRect(obstacles[i].x, obstacles[i].y, obstacles[i].width, obstacles[i].height);
        
        // Remove obstacles that are off screen
        if (obstacles[i].y > canvas.height) {
            obstacles.splice(i, 1);
            i--;
            score += 10;
            totalScore += 10;
            scoreElement.textContent = score;
            totalScoreElement.textContent = totalScore; // Update total score element
            
            // Increase difficulty as score increases
            if (score % 100 === 0) {
                increaseLevel();
            }
        }
    }
}

function increaseLevel() {
    level++;
    levelElement.textContent = level;
    
    // Increase game difficulty
    if (obstacleSpeed < 15) {
        obstacleSpeed += 0.5;
        roadSpeed += 0.5;
        
        // If slow motion is active, adjust the speed
        if (powerups.slowMotion.active) {
            obstacleSpeed = powerups.slowMotion.originalSpeed * powerups.slowMotion.speedFactor;
        } else {
            powerups.slowMotion.originalSpeed = obstacleSpeed;
        }
    }
    
    // Increase spawn rate
    if (spawnRate < 0.05) {
        spawnRate += 0.002;
    }
    
    // Change number of lanes every 3 levels
    if (level % 3 === 0 && numLanes < 6) {
        numLanes++;
        laneWidth = canvas.width / numLanes;
        lanesElement.textContent = numLanes;
    }
    
    // Display level up message
    showLevelUp();
}

function showLevelUp() {
    // Save current game state
    const tempObstacles = [...obstacles];
    obstacles = [];
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#FFD700'; // Gold color
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Level Up!', canvas.width / 2, canvas.height / 2 - 40);
    
    ctx.font = '28px Arial';
    ctx.fillText(`Level ${level}`, canvas.width / 2, canvas.height / 2 + 20);
    
    if (level % 3 === 0 && numLanes <= 6) {
        ctx.font = '24px Arial';
        ctx.fillText(`New lane added! Lanes: ${numLanes}`, canvas.width / 2, canvas.height / 2 + 60);
    }
    
    // Show message temporarily
    setTimeout(() => {
        obstacles = tempObstacles;
    }, 1500);
}

function checkCollisions() {
    for (const obstacle of obstacles) {
        if (
            car.x < obstacle.x + obstacle.width &&
            car.x + car.width > obstacle.x &&
            car.y < obstacle.y + obstacle.height &&
            car.y + car.height > obstacle.y
        ) {
            // If shield is active, destroy the obstacle instead of ending game
            if (powerups.shield.active) {
                // Remove the obstacle
                const index = obstacles.indexOf(obstacle);
                if (index > -1) {
                    obstacles.splice(index, 1);
                }
                
                // Deactivate the shield
                powerups.shield.active = false;
                car.shieldActive = false;
                updateActivePowerupsDisplay();
                
                // Give some points for destroying the obstacle
                score += 15;
                totalScore += 15;
                scoreElement.textContent = score;
                totalScoreElement.textContent = totalScore; // Update total score element
                
                // Show shield break effect
                showShieldBreakEffect(obstacle.x, obstacle.y);
                
                return; // Continue the game
            }
            
            // Collision detected and no shield
            gameOver = true;
            restartButton.style.display = 'inline-block';
        }
    }
}

function showShieldBreakEffect(x, y) {
    // Visual effect for shield breaking
    ctx.fillStyle = 'rgba(0, 128, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(x + 25, y + 40, 50, 0, Math.PI * 2);
    ctx.fill();
}

function updateScore() {
    scoreElement.textContent = score;
}

function showGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 40);
    
    ctx.font = '28px Arial';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText(`Level: ${level}`, canvas.width / 2, canvas.height / 2 + 60);
    
    // Show total accumulated score
    ctx.font = '20px Arial';
    ctx.fillText(`Total Score Accumulated: ${totalScore}`, canvas.width / 2, canvas.height / 2 + 100);
    
    // We don't need to add score to totalScore here because we're already
    // incrementing totalScore during gameplay
    
    // Cancel animation frame to stop the game loop
    cancelAnimationFrame(animationId);
    
    // Display restart button
    restartButton.style.display = 'inline-block';
}

function getRandomColor() {
    const colors = ['blue', 'green', 'purple', 'orange', 'yellow'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Initialize game
function init() {
    // Set canvas dimensions to match container
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    // Draw initial screen
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw road
    updateRoad();
    
    // Draw car in initial position
    drawCar();
    
    // Set initial powerup counts
    shieldCountElement.textContent = powerups.shield.count;
    slowMotionCountElement.textContent = powerups.slowMotion.count;
    magnetCountElement.textContent = powerups.magnet.count;
    
    // Display total score for purchasing
    totalScoreElement.textContent = totalScore; // Update total score element
    
    // Add event listeners for both buying and activating powerups
    shieldBtn.addEventListener('click', function() {
        if (!gameRunning && totalScore >= powerups.shield.cost) {
            // Between games: purchase the powerup
            purchasePowerup('shield');
        } else if (gameRunning && !gameOver && powerups.shield.count > 0 && !powerups.shield.active) {
            // During game: activate the powerup
            activateShield();
        }
    });
    
    slowMotionBtn.addEventListener('click', function() {
        if (!gameRunning && totalScore >= powerups.slowMotion.cost) {
            // Between games: purchase the powerup
            purchasePowerup('slowMotion');
        } else if (gameRunning && !gameOver && powerups.slowMotion.count > 0 && !powerups.slowMotion.active) {
            // During game: activate the powerup
            activateSlowMotion();
        }
    });
    
    magnetBtn.addEventListener('click', function() {
        if (!gameRunning && totalScore >= powerups.magnet.cost) {
            // Between games: purchase the powerup
            purchasePowerup('magnet');
        } else if (gameRunning && !gameOver && powerups.magnet.count > 0 && !powerups.magnet.active) {
            // During game: activate the powerup
            activateMagnet();
        }
    });
    
    updatePowerupButtons();
}

// Initialize the game when the window loads
window.addEventListener('load', init);