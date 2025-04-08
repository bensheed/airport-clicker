// Airport Clicker Game Logic

// Game state
const gameState = {
    money: 0,
    passengers: 0,
    reputation: 0,
    totalFlights: 0,
    totalPassengers: 0,
    airportLevel: 1,
    clickValue: 1,
    passengersPerClick: 1,
    moneyPerSecond: 0,
    passengersPerSecond: 0,
    buildings: [],
    staff: [],
    upgrades: [],
    clickCooldown: false // Add cooldown to prevent rapid clicking issues
};

let saveCounter = 0; // Counter for periodic saving

// Building definitions
const buildingDefinitions = [
    {
        id: 'runway',
        name: 'Runway',
        description: 'Allows planes to land and take off',
        baseCost: 10,
        moneyPerSecond: 0.5,
        passengersPerSecond: 0.2,
        owned: 0,
        unlocked: true
    },
    {
        id: 'terminal',
        name: 'Terminal',
        description: 'Processes passengers and provides shopping',
        baseCost: 50,
        moneyPerSecond: 2,
        passengersPerSecond: 1,
        owned: 0,
        unlocked: true
    },
    {
        id: 'hangar',
        name: 'Hangar',
        description: 'Stores and maintains aircraft',
        baseCost: 200,
        moneyPerSecond: 5,
        passengersPerSecond: 0.5,
        owned: 0,
        unlocked: true
    },
    {
        id: 'control-tower',
        name: 'Control Tower',
        description: 'Manages air traffic',
        baseCost: 1000,
        moneyPerSecond: 15,
        passengersPerSecond: 3,
        owned: 0,
        unlocked: false
    },
    {
        id: 'parking-garage',
        name: 'Parking Garage',
        description: 'Provides parking for passengers',
        baseCost: 5000,
        moneyPerSecond: 50,
        passengersPerSecond: 10,
        owned: 0,
        unlocked: false
    }
];

// Staff definitions
const staffDefinitions = [
    {
        id: 'pilot',
        name: 'Pilot',
        description: 'Flies the planes',
        baseCost: 25,
        clickMultiplier: 1.2,
        owned: 0,
        unlocked: true
    },
    {
        id: 'flight-attendant',
        name: 'Flight Attendant',
        description: 'Takes care of passengers',
        baseCost: 100,
        clickMultiplier: 1.5,
        owned: 0,
        unlocked: true
    },
    {
        id: 'mechanic',
        name: 'Mechanic',
        description: 'Maintains aircraft',
        baseCost: 500,
        clickMultiplier: 2,
        owned: 0,
        unlocked: false
    }
];

// Upgrade definitions
const upgradeDefinitions = [
    {
        id: 'better-seats',
        name: 'Better Seats',
        description: 'Improves passenger comfort',
        cost: 200,
        effect: 'Doubles passengers per click',
        purchased: false,
        unlocked: true,
        applyUpgrade: () => {
            gameState.passengersPerClick *= 2;
            addNotification('Upgrade purchased: Better Seats', 'success');
        }
    },
    {
        id: 'faster-check-in',
        name: 'Faster Check-in',
        description: 'Speeds up passenger processing',
        cost: 500,
        effect: 'Increases money per click by 50%',
        purchased: false,
        unlocked: true,
        applyUpgrade: () => {
            gameState.clickValue *= 1.5;
            addNotification('Upgrade purchased: Faster Check-in', 'success');
        }
    }
];

// Initialize game
function initGame() {
    // Initialize default state from definitions (use deep copy)
    gameState.buildings = JSON.parse(JSON.stringify(buildingDefinitions)); 
    gameState.staff = JSON.parse(JSON.stringify(staffDefinitions));
    gameState.upgrades = JSON.parse(JSON.stringify(upgradeDefinitions));
    
    // Attempt to load saved game state
    const loaded = loadGame(); // loadGame now returns true if loaded

    // Render initial UI based on loaded or default state
    updateResourceDisplay();
    renderBuildings();
    renderStaff();
    renderUpgrades();
    updateButtonStates(); 
    updateTabBadges(); 

    // Set up event listeners
    document.getElementById('main-clicker').addEventListener('click', handleMainClick);
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    const resetButton = document.getElementById('reset-progress-button');
    if (resetButton) {
        resetButton.addEventListener('click', resetProgress);
    } else {
        console.error('Reset button not found!');
    }

    // Start game loop
    setInterval(gameLoop, 1000);
    
    // Welcome / Load notification
    if (!loaded) {
        addNotification('Welcome to Airport Clicker! Click "Operate Flight" to start earning money.', 'info');
    } else {
        addNotification('Game progress loaded.', 'info');
    }
}

// Main click handler
function handleMainClick() {
    // Prevent rapid clicking
    if (gameState.clickCooldown) return;
    
    // Set cooldown
    gameState.clickCooldown = true;
    
    // Calculate click value with multipliers
    let moneyEarned = gameState.clickValue;
    let passengersGained = gameState.passengersPerClick;
    
    // Apply staff multipliers
    gameState.staff.forEach(staff => {
        if (staff.owned > 0) {
            moneyEarned *= Math.pow(staff.clickMultiplier, staff.owned);
        }
    });
    
    // Update game state
    gameState.money += moneyEarned;
    gameState.passengers += passengersGained;
    gameState.totalFlights += 1;
    gameState.totalPassengers += passengersGained;
    
    // Update reputation based on passengers (1 reputation per 100 passengers)
    gameState.reputation = Math.floor(gameState.totalPassengers / 100);
    
    // Update display
    updateResourceDisplay();
    
    // Show click feedback
    showClickFeedback(`+$${moneyEarned.toFixed(1)}, +${passengersGained} passengers`);
    
    // Check for level up
    checkLevelUp();
    
    // Re-render buildings, staff, and upgrades to update buy buttons
    renderBuildings();
    renderStaff();
    renderUpgrades();
    
    updateTabBadges();
    // Debug log
    console.log("After click - Money:", gameState.money, "Passengers:", gameState.passengers);
    
    // Reset cooldown after a short delay
    setTimeout(() => {
        gameState.clickCooldown = false;
    }, 100);
}

// Show floating feedback when clicking
function showClickFeedback(text) {
    const feedback = document.createElement('div');
    feedback.className = 'click-feedback-item';
    feedback.textContent = text;
    
    document.getElementById('click-feedback').appendChild(feedback);
    
    // Remove after animation completes
    setTimeout(() => {
        feedback.remove();
    }, 1500);
}
// Update the enabled/disabled state of buy/hire buttons
function updateButtonStates() {
    const currentMoney = gameState.money;
    const buttons = document.querySelectorAll('.buy-button');

    buttons.forEach(button => {
        let item;
        let cost;
        let isPurchased = false; // Specific to upgrades

        const buildingId = button.getAttribute('data-building');
        const staffId = button.getAttribute('data-staff');
        const upgradeId = button.getAttribute('data-upgrade');

        if (buildingId) {
            item = gameState.buildings.find(b => b.id === buildingId);
            if (item) {
                cost = Math.floor(item.baseCost * Math.pow(1.15, item.owned));
            }
        } else if (staffId) {
            item = gameState.staff.find(s => s.id === staffId);
            if (item) {
                cost = Math.floor(item.baseCost * Math.pow(1.2, item.owned));
            }
        } else if (upgradeId) {
            item = gameState.upgrades.find(u => u.id === upgradeId);
            if (item) {
                cost = item.cost;
                isPurchased = item.purchased;
            }
        }

        if (item) {
            // Disable if purchased (for upgrades) or if cannot afford
            button.disabled = isPurchased || currentMoney < cost;
        } else {
            // If item not found for some reason, disable the button
            button.disabled = true;
        }
    });
}


// Game loop (runs every second)
function gameLoop() {
    // Calculate passive income
    let moneyPerSecond = 0;
    let passengersPerSecond = 0;
    
    // Add income from buildings
    gameState.buildings.forEach(building => {
        moneyPerSecond += building.moneyPerSecond * building.owned;
        passengersPerSecond += building.passengersPerSecond * building.owned;
    });
    
    // Update game state
    gameState.money += moneyPerSecond;
    gameState.passengers += passengersPerSecond;
    gameState.totalPassengers += passengersPerSecond;
    
    // Update reputation based on passengers (1 reputation per 100 passengers)
    gameState.reputation = Math.floor(gameState.totalPassengers / 100);
    
    // Update display
    updateResourceDisplay();
    updateButtonStates(); // Update button states based on new money
    
    // Check for level up
    checkLevelUp();
    
    // Update passive income rates for display
    gameState.moneyPerSecond = moneyPerSecond;
    gameState.passengersPerSecond = passengersPerSecond;
    // Periodic save
    saveCounter++;
    if (saveCounter >= 15) {
        saveGame();
        saveCounter = 0;
    }
    updateTabBadges();
}

// Check if airport level should increase
function checkLevelUp() {
    const newLevel = Math.floor(gameState.reputation / 10) + 1;
    
    if (newLevel > gameState.airportLevel) {
        gameState.airportLevel = newLevel;
        document.getElementById('airport-level').textContent = newLevel;
        
        // Unlock new content based on level
        unlockContent(newLevel);
        
        addNotification(`Your airport has reached level ${newLevel}!`, 'success');
    }
}

// Unlock new content based on level
function unlockContent(level) {
    if (level >= 2) {
        // Unlock Control Tower
        const controlTower = gameState.buildings.find(b => b.id === 'control-tower');
        if (controlTower && !controlTower.unlocked) {
            controlTower.unlocked = true;
            addNotification('New building unlocked: Control Tower', 'info');
            renderBuildings();
        }
        
        // Unlock Mechanic
        const mechanic = gameState.staff.find(s => s.id === 'mechanic');
        if (mechanic && !mechanic.unlocked) {
            mechanic.unlocked = true;
            addNotification('New staff unlocked: Mechanic', 'info');
            renderStaff();
        }
    }
    
    if (level >= 3) {
        // Unlock Parking Garage
        const parkingGarage = gameState.buildings.find(b => b.id === 'parking-garage');
        if (parkingGarage && !parkingGarage.unlocked) {
            parkingGarage.unlocked = true;
            addNotification('New building unlocked: Parking Garage', 'info');
            renderBuildings();
        }
    }
}

// Update resource display
function updateResourceDisplay() {
    document.getElementById('money').textContent = gameState.money.toFixed(1);
    document.getElementById('passengers').textContent = gameState.passengers.toFixed(0);
    document.getElementById('reputation').textContent = gameState.reputation.toFixed(0);
    document.getElementById('total-flights').textContent = gameState.totalFlights;
    document.getElementById('total-passengers').textContent = gameState.totalPassengers.toFixed(0);
    document.getElementById('airport-level').textContent = gameState.airportLevel;
}

// Update tab badges based on affordability and active tab
function updateTabBadges() {
    const currentMoney = gameState.money;
    const activeTabId = document.querySelector('.tab-pane.active')?.id;

    // Check Buildings
    const canAffordBuilding = gameState.buildings.some(b => b.unlocked && currentMoney >= Math.floor(b.baseCost * Math.pow(1.15, b.owned)));
    const buildingTabButton = document.querySelector('.tab-button[data-tab="buildings"] .badge');
    if (buildingTabButton) {
        buildingTabButton.classList.toggle('visible', canAffordBuilding && activeTabId !== 'buildings');
    }

    // Check Staff
    const canAffordStaff = gameState.staff.some(s => s.unlocked && currentMoney >= Math.floor(s.baseCost * Math.pow(1.2, s.owned)));
    const staffTabButton = document.querySelector('.tab-button[data-tab="staff"] .badge');
    if (staffTabButton) {
        staffTabButton.classList.toggle('visible', canAffordStaff && activeTabId !== 'staff');
    }

    // Check Upgrades
    const canAffordUpgrade = gameState.upgrades.some(u => u.unlocked && !u.purchased && currentMoney >= u.cost);
    const upgradeTabButton = document.querySelector('.tab-button[data-tab="upgrades"] .badge');
    if (upgradeTabButton) {
        upgradeTabButton.classList.toggle('visible', canAffordUpgrade && activeTabId !== 'upgrades');
    }
}


// Switch between tabs
function switchTab(tabId) {
    // Hide all tab panes
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => {
        pane.classList.remove('active');
    });
    
    // Deactivate all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab pane
    document.getElementById(tabId).classList.add('active');
    
    // Activate selected tab button
    document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
}
    updateTabBadges(); // Update badges after tab switch

// Render buildings tab
function renderBuildings() {
    const buildingList = document.querySelector('.building-list');
    buildingList.innerHTML = '';
    
    gameState.buildings.forEach(building => {
        if (building.unlocked) {
            const buildingCost = Math.floor(building.baseCost * Math.pow(1.15, building.owned));
            const canAfford = gameState.money >= buildingCost;
            
            const buildingElement = document.createElement('div');
            buildingElement.className = 'building-item';
            buildingElement.innerHTML = `
                <div class="building-name">${building.name} (${building.owned})</div>
                <div class="building-cost">Cost: $${buildingCost}</div>
                <div class="building-description">${building.description}</div>
                <div class="building-production">Produces: $${building.moneyPerSecond}/s, ${building.passengersPerSecond} passengers/s</div>
                <button class="buy-button" data-building="${building.id}" ${canAfford ? '' : 'disabled'}>Buy</button>
            `;
            
            buildingList.appendChild(buildingElement);
            
            // Add event listener to buy button
            const buyButton = buildingElement.querySelector('.buy-button');
            buyButton.addEventListener('click', () => {
                buyBuilding(building.id);
            });
        }
    });
    
    // Debug log
    console.log("Current money:", gameState.money);
}

// Buy a building
function buyBuilding(buildingId) {
    const building = gameState.buildings.find(b => b.id === buildingId);
    
    if (building) {
        const cost = Math.floor(building.baseCost * Math.pow(1.15, building.owned));
        
        if (gameState.money >= cost) {
            gameState.money -= cost;
            building.owned += 1;
            
            addNotification(`Purchased a ${building.name}`, 'success');
            
            // Debug log
            console.log(`Purchased ${building.name} for $${cost}. New money: ${gameState.money}`);
            
            // Update display
            updateResourceDisplay();
            renderBuildings();
            
            // Re-render staff and upgrades to update their buy buttons too
            renderStaff();
            renderUpgrades();
            updateTabBadges();
            saveGame(); // Save after purchase
        } else {
            console.log(`Cannot afford ${building.name}. Cost: $${cost}, Money: ${gameState.money}`);
        }
    }
}

// Render staff tab
function renderStaff() {
    const staffList = document.querySelector('.staff-list');
    staffList.innerHTML = '';
    
    gameState.staff.forEach(staff => {
        if (staff.unlocked) {
            const staffCost = Math.floor(staff.baseCost * Math.pow(1.2, staff.owned));
            const canAfford = gameState.money >= staffCost;
            
            const staffElement = document.createElement('div');
            staffElement.className = 'staff-item';
            staffElement.innerHTML = `
                <div class="staff-name">${staff.name} (${staff.owned})</div>
                <div class="staff-cost">Cost: $${staffCost}</div>
                <div class="staff-description">${staff.description}</div>
                <div class="staff-bonus">Click Bonus: ${((staff.clickMultiplier - 1) * 100).toFixed(0)}% per ${staff.name}</div>
                <button class="buy-button" data-staff="${staff.id}" ${canAfford ? '' : 'disabled'}>Hire</button>
            `;
            
            staffList.appendChild(staffElement);
            
            // Add event listener to buy button
            const buyButton = staffElement.querySelector('.buy-button');
            buyButton.addEventListener('click', () => {
                hireStaff(staff.id);
            });
        }
    });
}

// Hire staff
function hireStaff(staffId) {
    const staff = gameState.staff.find(s => s.id === staffId);
    
    if (staff) {
        const cost = Math.floor(staff.baseCost * Math.pow(1.2, staff.owned));
        
        if (gameState.money >= cost) {
            gameState.money -= cost;
            staff.owned += 1;
            
            addNotification(`Hired a ${staff.name}`, 'success');
            
            // Debug log
            console.log(`Hired ${staff.name} for $${cost}. New money: ${gameState.money}`);
            
            // Update display
            updateResourceDisplay();
            renderStaff();
            
            // Re-render buildings and upgrades to update their buy buttons too
            renderBuildings();
            updateTabBadges();
            saveGame(); // Save after hire
            renderUpgrades();
        } else {
            console.log(`Cannot afford ${staff.name}. Cost: $${cost}, Money: ${gameState.money}`);
        }
    }
}

// Render upgrades tab
function renderUpgrades() {
    const upgradeList = document.querySelector('.upgrade-list');
    upgradeList.innerHTML = '';
    
    gameState.upgrades.forEach(upgrade => {
        if (upgrade.unlocked && !upgrade.purchased) {
            const canAfford = gameState.money >= upgrade.cost;
            
            const upgradeElement = document.createElement('div');
            upgradeElement.className = 'upgrade-item';
            upgradeElement.innerHTML = `
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-cost">Cost: $${upgrade.cost}</div>
                <div class="upgrade-description">${upgrade.description}</div>
                <div class="upgrade-effect">${upgrade.effect}</div>
                <button class="buy-button" data-upgrade="${upgrade.id}" ${canAfford ? '' : 'disabled'}>Purchase</button>
            `;


            
            upgradeList.appendChild(upgradeElement);
            
            updateTabBadges();
            // Add event listener to buy button
            const buyButton = upgradeElement.querySelector('.buy-button');
            buyButton.addEventListener('click', () => {
                purchaseUpgrade(upgrade.id);
            });
        }
    });
}

// Purchase an upgrade
function purchaseUpgrade(upgradeId) {
    const upgrade = gameState.upgrades.find(u => u.id === upgradeId);
    
    if (upgrade && !upgrade.purchased) {
        if (gameState.money >= upgrade.cost) {
            gameState.money -= upgrade.cost;
            upgrade.purchased = true;
            
            // Apply upgrade effect
            upgrade.applyUpgrade();
            
            // Debug log
            console.log(`Purchased upgrade ${upgrade.name} for $${upgrade.cost}. New money: ${gameState.money}`);
            
            // Update display
            updateResourceDisplay();
            renderUpgrades();
            
            // Re-render buildings and staff to update their buy buttons too
            renderBuildings();
            renderStaff();
            saveGame(); // Save after upgrade
        } else {
            console.log(`Cannot afford upgrade ${upgrade.name}. Cost: $${upgrade.cost}, Money: ${gameState.money}`);
        }
    }
}

// Add a notification
function addNotification(message, type = 'info') {
    const notificationList = document.getElementById('notification-list');
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationList.prepend(notification);
    
    // Limit to 10 notifications
    const notifications = notificationList.querySelectorAll('.notification');
    if (notifications.length > 10) {
        notifications[notifications.length - 1].remove();
    }
}

// Load game state from localStorage
function loadGame() {
    try {
        const savedStateJSON = localStorage.getItem('airportClickerSave');
        if (savedStateJSON) {
            const loadedState = JSON.parse(savedStateJSON);
            for (const key in loadedState) {
                if (gameState.hasOwnProperty(key)) {
                    if (Array.isArray(gameState[key]) && Array.isArray(loadedState[key])) {
                        gameState[key].forEach(defaultItem => {
                            const loadedItem = loadedState[key].find(item => item.id === defaultItem.id);
                            if (loadedItem) {
                                if (loadedItem.hasOwnProperty('owned')) defaultItem.owned = loadedItem.owned;
                                if (loadedItem.hasOwnProperty('purchased')) defaultItem.purchased = loadedItem.purchased;
                                if (loadedItem.hasOwnProperty('unlocked') && loadedItem.unlocked) defaultItem.unlocked = true;
                            }
                        });
                    } else {
                        gameState[key] = loadedState[key];
                    }
                }
            }
            console.log('Game loaded!');
            return true; // Indicate that a save was loaded
        } else {
            console.log('No save game found.');
        }
    } catch (e) {
        console.error("Failed to load game:", e);
        localStorage.removeItem('airportClickerSave');
    }
    return false; // Indicate no save was loaded
}

// Save game state to localStorage
function saveGame() {
    try {
        localStorage.setItem('airportClickerSave', JSON.stringify(gameState));
    } catch (e) {
        console.error("Failed to save game:", e);
        addNotification('Error saving game. Storage might be full or disabled.', 'error');
    }
}

// Reset game progress
function resetProgress() {
    if (confirm("Are you sure you want to reset all progress? This cannot be undone.")) {
        try {
            localStorage.removeItem('airportClickerSave');
            // Reset gameState in memory
            gameState.money = 0;
            gameState.passengers = 0;
            gameState.reputation = 0;
            gameState.totalFlights = 0;
            gameState.totalPassengers = 0;
            gameState.airportLevel = 1;
            gameState.clickValue = 1;
            gameState.passengersPerClick = 1;
            gameState.moneyPerSecond = 0;
            gameState.passengersPerSecond = 0;
            gameState.buildings = JSON.parse(JSON.stringify(buildingDefinitions)); 
            gameState.staff = JSON.parse(JSON.stringify(staffDefinitions));
            gameState.upgrades = JSON.parse(JSON.stringify(upgradeDefinitions));
            saveCounter = 0;
            // Re-render UI
            updateResourceDisplay();
            renderBuildings();
            renderStaff();
            renderUpgrades();
            updateButtonStates();
            updateTabBadges();
            addNotification('Game progress reset.', 'warning');
            console.log("Game reset complete.");
        } catch (e) {
            console.error("Failed to reset game:", e);
            addNotification('Error resetting progress.', 'error');
        }
    }
}


// Initialize the game when the DOM is loaded
document.addEventListener('DOMContentLoaded', initGame);