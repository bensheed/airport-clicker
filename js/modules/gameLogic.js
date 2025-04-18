// Import state and UI functions
import { gameState, saveGame, incrementSaveCounter, resetSaveCounter } from './state.js';
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

// Main click handler - "Operate Flight"
export function handleMainClick() {
    // Prevent rapid clicking
    if (gameState.clickCooldown) return;
    
    // Set cooldown
    gameState.clickCooldown = true;
    
    // --- Calculate Money Earned --- 
    let moneyEarned = gameState.baseClickValue;

    // 1. Apply Runway Boosts (additive to base value)
    const runways = gameState.buildings.find(b => b.id === 'runway');
    const numRunways = runways ? runways.owned : 0;
    if (numRunways > 0) {
        const runwayBoostPerRunway = runways.moneyPerClickBoost || 0;
        
        // 2. Apply Control Tower Efficiency Boost (multiplicative to runway boost)
        const controlTowers = gameState.buildings.find(b => b.id === 'control-tower');
        const numTowers = controlTowers ? controlTowers.owned : 0;
        const towerEfficiencyMultiplier = 1 + (numTowers * (controlTowers?.runwayEfficiencyBoost || 0));
        
        moneyEarned += gameState.baseClickValue * (numRunways * runwayBoostPerRunway * towerEfficiencyMultiplier);
    }

    // 3. Apply Pilot Bonuses (multiplicative)
    let pilotMultiplier = 1;
    gameState.staff.forEach(staff => {
        if (staff.id === 'pilot' && staff.owned > 0) {
            pilotMultiplier *= Math.pow(1 + (staff.moneyPerClickBonus || 0), staff.owned);
        }
    });
    moneyEarned *= pilotMultiplier;

    // 4. Apply Global Click Multiplier Upgrades (e.g., Better Seats)
    moneyEarned *= (gameState.moneyPerClickMultiplier || 1);

    // --- Update Game State --- 
    gameState.money += moneyEarned;
    gameState.totalFlights += 1;
    // Passengers are no longer gained directly from clicks
    // gameState.passengers += passengersGained; 
    // gameState.totalPassengers += passengersGained;
    
    // Update reputation based on total passengers (still updated passively)
    gameState.reputation = Math.floor(gameState.totalPassengers / 100);
    
    // --- Update UI --- 
    updateResourceDisplay();
    showClickFeedback(`+$${moneyEarned.toFixed(1)}`); // Only show money feedback
    checkLevelUp();
    
    // Update button states as money changed
    updateButtonStates(); 
    updateTabBadges();
    
    // Reset cooldown after a short delay
    setTimeout(() => {
        gameState.clickCooldown = false;
    }, 100); // 100ms cooldown
}

// Game loop (runs every second)
export function gameLoop() {
    // --- Calculate Passive Passenger Arrival --- 
    // Base arrival rate could be 0 or a small constant
    let basePassengerArrival = 0.1; 
    // Arrival rate increases with reputation (e.g., +0.1 passengers/sec per 10 reputation)
    let reputationBonus = Math.max(0, gameState.reputation) * 0.01; // Simple linear scaling for now
    let passengersPerSecond = basePassengerArrival + reputationBonus;

    // --- Calculate Passive Income --- 
    let moneyPerSecond = 0;
    // 1. Income from buildings (Terminals, Parking Garages)
    gameState.buildings.forEach(building => {
        if (building.moneyPerSecondBase && building.owned > 0) {
            // Scale base income by reputation (e.g., 1 + reputation/100)
            let reputationMultiplier = 1 + (Math.max(0, gameState.reputation) / 100);
            moneyPerSecond += building.moneyPerSecondBase * building.owned * reputationMultiplier;
        }
    });

    // 2. Apply Staff Bonuses (Attendants, Mechanics)
    let staffPassiveMultiplier = 1;
    gameState.staff.forEach(staff => {
        if (staff.passiveIncomeBonus && staff.owned > 0) {
            staffPassiveMultiplier *= Math.pow(1 + staff.passiveIncomeBonus, staff.owned);
        }
    });
    moneyPerSecond *= staffPassiveMultiplier;

    // 3. Apply Global Passive Income Multiplier Upgrades (e.g., Faster Check-in)
    moneyPerSecond *= (gameState.passiveIncomeMultiplier || 1);

    // --- Update Game State --- 
    gameState.money += moneyPerSecond;
    gameState.passengers += passengersPerSecond;
    gameState.totalPassengers += passengersPerSecond;
    
    // Update reputation based on total passengers
    gameState.reputation = Math.floor(gameState.totalPassengers / 100);
    
    // Update calculated rates in gameState for display purposes
    gameState.moneyPerSecond = moneyPerSecond;
    gameState.passengersPerSecond = passengersPerSecond;

    // --- Update UI & Save --- 
    updateResourceDisplay();
    updateButtonStates(); // Update button states based on new money
    checkLevelUp();
    updateTabBadges();
    
    // Periodic save
    incrementSaveCounter();
    if (saveCounter >= 15) { // Use exported saveCounter
        saveGame();
        resetSaveCounter();
    }
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
