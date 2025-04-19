// Import state and UI functions
import { gameState, saveGame, saveCounter, incrementSaveCounter, resetSaveCounter } from './state.js';
import { 
    updateResourceDisplay, 
    showClickFeedback, 
    renderBuildings, 
    renderStaff, 
    renderUpgrades, 
    addNotification,
    updateButtonStates,
    updateTabBadges
} from './ui.js';

// Main click handler
export function handleMainClick() {
    console.log('handleMainClick called');
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
            // Ensure clickMultiplier is defined and is a number
            if (typeof staff.clickMultiplier === 'number') {
                 moneyEarned *= Math.pow(staff.clickMultiplier, staff.owned);
            } else {
                console.warn(`Staff ${staff.id} has invalid clickMultiplier: ${staff.clickMultiplier}`);
            }
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
    // Note: Re-rendering everything on every click might be inefficient later
    renderBuildings();
    renderStaff();
    renderUpgrades();
    updateTabBadges();
    
    // Reset cooldown after a short delay
    setTimeout(() => {
        gameState.clickCooldown = false;
    }, 100); // 100ms cooldown
}

// Game loop (runs every second)
export function gameLoop() {
    // Calculate passive income
    let moneyPerSecond = 0;
    let passengersPerSecond = 0;
    
    // Add income from buildings
    gameState.buildings.forEach(building => {
        moneyPerSecond += (building.moneyPerSecond || 0) * building.owned;
        passengersPerSecond += (building.passengersPerSecond || 0) * building.owned;
    });
    
    // Update game state
    gameState.money += moneyPerSecond;
    gameState.passengers += passengersPerSecond;
    gameState.totalPassengers += passengersPerSecond;
    
    // Update reputation based on passengers
    gameState.reputation = Math.floor(gameState.totalPassengers / 100);
    
    // Update display
    updateResourceDisplay();
    updateButtonStates(); // Update button states based on new money
    
    // Check for level up
    checkLevelUp();
    
    // Update passive income rates in gameState for display purposes
    gameState.moneyPerSecond = moneyPerSecond;
    gameState.passengersPerSecond = passengersPerSecond;
    
    // Periodic save
    incrementSaveCounter();
    if (saveCounter >= 15) { // Use exported saveCounter
        saveGame();
        resetSaveCounter();
    }
    updateTabBadges();
}

// Check if airport level should increase
export function checkLevelUp() {
    const newLevel = Math.floor(gameState.reputation / 10) + 1;
    
    if (newLevel > gameState.airportLevel) {
        gameState.airportLevel = newLevel;
        // Update level display directly (or rely on updateResourceDisplay)
        const airportLevelEl = document.getElementById('airport-level');
        if (airportLevelEl) airportLevelEl.textContent = newLevel;
        
        // Unlock new content based on level
        unlockContent(newLevel);
        
        addNotification(`Your airport has reached level ${newLevel}!`, 'success');
    }
}

// Unlock new content based on level
export function unlockContent(level) {
    let contentUnlocked = false;
    if (level >= 2) {
        // Unlock Control Tower
        const controlTower = gameState.buildings.find(b => b.id === 'control-tower');
        if (controlTower && !controlTower.unlocked) {
            controlTower.unlocked = true;
            addNotification('New building unlocked: Control Tower', 'info');
            contentUnlocked = true;
        }
        
        // Unlock Mechanic
        const mechanic = gameState.staff.find(s => s.id === 'mechanic');
        if (mechanic && !mechanic.unlocked) {
            mechanic.unlocked = true;
            addNotification('New staff unlocked: Mechanic', 'info');
            contentUnlocked = true;
        }
    }
    
    if (level >= 3) {
        // Unlock Parking Garage
        const parkingGarage = gameState.buildings.find(b => b.id === 'parking-garage');
        if (parkingGarage && !parkingGarage.unlocked) {
            parkingGarage.unlocked = true;
            addNotification('New building unlocked: Parking Garage', 'info');
            contentUnlocked = true;
        }
    }

    // Re-render relevant tabs if content was unlocked
    if (contentUnlocked) {
        renderBuildings();
        renderStaff();
        updateTabBadges(); // Update badges as new items might be affordable
    }
}

// Buy a building
export function buyBuilding(buildingId) {
    const building = gameState.buildings.find(b => b.id === buildingId);
    
    if (building) {
        const cost = Math.floor(building.baseCost * Math.pow(1.15, building.owned));
        
        if (gameState.money >= cost) {
            gameState.money -= cost;
            building.owned += 1;
            
            addNotification(`Purchased a ${building.name}`, 'success');
            
            // Update display & save
            updateResourceDisplay();
            renderBuildings(); // Re-render this tab
            updateButtonStates(); // Update all buttons
            updateTabBadges();
            saveGame(); 
        } else {
            addNotification(`Not enough money for ${building.name}`, 'warning');
        }
    }
}

// Hire staff
export function hireStaff(staffId) {
    const staff = gameState.staff.find(s => s.id === staffId);
    
    if (staff) {
        const cost = Math.floor(staff.baseCost * Math.pow(1.2, staff.owned));
        
        if (gameState.money >= cost) {
            gameState.money -= cost;
            staff.owned += 1;
            
            addNotification(`Hired a ${staff.name}`, 'success');
            
            // Update display & save
            updateResourceDisplay();
            renderStaff(); // Re-render this tab
            updateButtonStates(); // Update all buttons
            updateTabBadges();
            saveGame();
        } else {
            addNotification(`Not enough money for ${staff.name}`, 'warning');
        }
    }
}

// Purchase an upgrade
export function purchaseUpgrade(upgradeId) {
    const upgrade = gameState.upgrades.find(u => u.id === upgradeId);
    
    // Make sure upgrade exists and is not already purchased
    if (upgrade && !upgrade.purchased) { 
        if (gameState.money >= upgrade.cost) {
            gameState.money -= upgrade.cost;
            upgrade.purchased = true;
            
            // Apply upgrade effect - Find the corresponding definition for the function
            // This assumes the applyUpgrade function in gameState.upgrades is correctly copied/referenced
            if (typeof upgrade.applyUpgrade === 'function') {
                 upgrade.applyUpgrade(); // This will need access to gameState, potentially addNotification
            } else {
                console.warn(`Upgrade ${upgrade.id} has no applyUpgrade function or it's not a function.`);
            }
            
            // Update display & save
            updateResourceDisplay();
            renderUpgrades(); // Re-render this tab
            updateButtonStates(); // Update all buttons
            updateTabBadges(); 
            saveGame();
        } else {
             addNotification(`Not enough money for ${upgrade.name}`, 'warning');
        }
    } else if (upgrade && upgrade.purchased) {
        // console.log(`Upgrade ${upgrade.name} already purchased.`); // Optional feedback
    } else {
        console.error(`Upgrade with ID ${upgradeId} not found.`);
    }
}
