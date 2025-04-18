// Import necessary definitions and UI functions (placeholders)
import { buildingDefinitions, staffDefinitions, upgradeDefinitions } from './definitions.js';
import { addNotification, updateResourceDisplay, renderBuildings, renderStaff, renderUpgrades, updateButtonStates, updateTabBadges } from './ui.js'; // Assuming these will be in ui.js

// Game state
export const gameState = {
    money: 0,
    passengers: 0, // Current passengers at the airport
    reputation: 0, // Influences passive passenger arrival and income
    totalFlights: 0,
    totalPassengers: 0, // Cumulative passengers served
    airportLevel: 1,
    baseClickValue: 10, // Base money earned per "Operate Flight" click
    // clickValue: 1, // Replaced by calculated value
    // passengersPerClick: 1, // Removed - passengers arrive passively
    moneyPerSecond: 0, // Calculated passive income
    passengersPerSecond: 0, // Calculated passive passenger arrival rate
    buildings: [], // Will be initialized from definitions
    staff: [],     // Will be initialized from definitions
    upgrades: [],   // Will be initialized from definitions
    clickCooldown: false,
    // Multipliers from upgrades
    moneyPerClickMultiplier: 1, 
    passiveIncomeMultiplier: 1,
};

// Counter for periodic saving
export let saveCounter = 0;

export function incrementSaveCounter() {
    saveCounter++;
}

export function resetSaveCounter() {
    saveCounter = 0;
}


// Load game state from localStorage
export function loadGame() {
    try {
        const savedStateJSON = localStorage.getItem('airportClickerSave');
        if (savedStateJSON) {
            const loadedState = JSON.parse(savedStateJSON);

            // Carefully merge loaded state into default gameState structure
            // Basic properties to load
            const basicProps = [
                'money', 'passengers', 'reputation', 'totalFlights', 'totalPassengers', 
                'airportLevel', 'baseClickValue', 
                'moneyPerClickMultiplier', 'passiveIncomeMultiplier' // Load new multipliers
                // Removed: 'clickValue', 'passengersPerClick', 'moneyPerSecond', 'passengersPerSecond' (these are calculated)
            ];
            basicProps.forEach(prop => {
                if (loadedState.hasOwnProperty(prop) && typeof loadedState[prop] === typeof gameState[prop]) {
                    gameState[prop] = loadedState[prop];
                }
            });

            // Merge arrays (Buildings, Staff, Upgrades)
            ['buildings', 'staff', 'upgrades'].forEach(key => {
                if (Array.isArray(loadedState[key])) {
                    // Ensure default definitions exist before attempting merge
                    if (!Array.isArray(gameState[key])) {
                         console.warn(`gameState.${key} is not an array during load, skipping merge for this key.`);
                         return;
                    }
                    gameState[key].forEach(defaultItem => {
                        const loadedItem = loadedState[key].find(item => item.id === defaultItem.id);
                        if (loadedItem) {
                            // Copy saved properties if they exist in the loaded data and the default item
                            if (defaultItem.hasOwnProperty('owned') && loadedItem.hasOwnProperty('owned')) defaultItem.owned = loadedItem.owned;
                            if (defaultItem.hasOwnProperty('purchased') && loadedItem.hasOwnProperty('purchased')) defaultItem.purchased = loadedItem.purchased;
                            if (defaultItem.hasOwnProperty('unlocked') && loadedItem.hasOwnProperty('unlocked')) defaultItem.unlocked = loadedItem.unlocked;
                        } // Keep default if not found in save
                    });
                }
            });

            console.log('Game loaded!');
            return true; // Indicate that a save was loaded
        } else {
            console.log('No save game found.');
        }
    } catch (e) {
        console.error("Failed to load game:", e);
        // If loading fails, clear potentially corrupted save and start fresh
        localStorage.removeItem('airportClickerSave');
        addNotification('Error loading save game. Starting fresh.', 'error'); // Needs ui.js
    }
    return false; // Indicate no save was loaded or load failed
}

// Save game state to localStorage
export function saveGame() {
    // Create a slimmed-down version of gameState for saving
    const stateToSave = {
        money: gameState.money,
        passengers: gameState.passengers,
        reputation: gameState.reputation,
        totalFlights: gameState.totalFlights,
        totalPassengers: gameState.totalPassengers,
        airportLevel: gameState.airportLevel,
        baseClickValue: gameState.baseClickValue, // Save base click value
        moneyPerClickMultiplier: gameState.moneyPerClickMultiplier, // Save multipliers
        passiveIncomeMultiplier: gameState.passiveIncomeMultiplier,
        // Removed: clickValue, passengersPerClick (calculated or obsolete)
        // Only save essential data for items that change
        buildings: gameState.buildings.map(b => ({ id: b.id, owned: b.owned, unlocked: b.unlocked })),
        staff: gameState.staff.map(s => ({ id: s.id, owned: s.owned, unlocked: s.unlocked })),
        upgrades: gameState.upgrades.map(u => ({ id: u.id, purchased: u.purchased, unlocked: u.unlocked }))
    };

    try {
        localStorage.setItem('airportClickerSave', JSON.stringify(stateToSave));
        // console.log('Game saved.'); // Reduce console noise
    } catch (e) {
        console.error("Failed to save game:", e);
        addNotification('Error saving game. Storage might be full or disabled.', 'error'); // Needs ui.js
    }
}

// Reset game progress
export function resetProgress() {
    if (confirm("Are you sure you want to reset all progress? This cannot be undone.")) {
        try {
            localStorage.removeItem('airportClickerSave');

            // Reset gameState in memory to initial defaults
            gameState.money = 0;
            gameState.passengers = 0;
            gameState.reputation = 0;
            gameState.totalFlights = 0;
            gameState.totalPassengers = 0;
            gameState.airportLevel = 1;
            gameState.baseClickValue = 10; // Reset base click value
            // gameState.clickValue = 1; // Removed
            // gameState.passengersPerClick = 1; // Removed
            gameState.moneyPerSecond = 0;
            gameState.passengersPerSecond = 0;
            gameState.moneyPerClickMultiplier = 1; // Reset multipliers
            gameState.passiveIncomeMultiplier = 1;
            // Deep copy from original definitions again
            gameState.buildings = JSON.parse(JSON.stringify(buildingDefinitions)); // Needs definitions.js
            gameState.staff = JSON.parse(JSON.stringify(staffDefinitions));       // Needs definitions.js
            gameState.upgrades = JSON.parse(JSON.stringify(upgradeDefinitions));     // Needs definitions.js
            resetSaveCounter();

            // Re-render the entire UI (Needs ui.js)
            updateResourceDisplay();
            renderBuildings();
            renderStaff();
            renderUpgrades();
            updateButtonStates();
            updateTabBadges();
            // Clear notifications
            const notificationList = document.getElementById('notification-list');
            if (notificationList) {
                notificationList.innerHTML = '';
            }
            addNotification('Game progress reset.', 'warning');
            console.log("Game reset complete.");
        } catch (e) {
            console.error("Failed to reset game:", e);
            addNotification('Error resetting game progress.', 'error'); // Needs ui.js
        }
    }
}
