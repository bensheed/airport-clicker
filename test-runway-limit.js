// Test script for runway limit
const fs = require('fs');

// Mock the gameState
const gameState = {
    money: 1000000, // Plenty of money for testing
    buildings: [
        {
            id: 'runway',
            name: 'Runway',
            description: 'Allows planes to land and take off (Max: 8)',
            baseCost: 10,
            moneyPerSecond: 0.5,
            passengersPerSecond: 0.2,
            owned: 0,
            unlocked: true
        }
    ]
};

// Mock the UI functions
const addNotification = (message, type) => {
    console.log(`NOTIFICATION (${type}): ${message}`);
};

const updateResourceDisplay = () => {};
const renderBuildings = () => {};
const updateButtonStates = () => {};
const updateTabBadges = () => {};
const saveGame = () => {};

// Import the buyBuilding function logic
const buyBuilding = (buildingId) => {
    const building = gameState.buildings.find(b => b.id === buildingId);
    
    if (building) {
        // Check if this is a runway and if we've reached the maximum (8)
        if (building.id === 'runway' && building.owned >= 8) {
            addNotification(`Maximum number of runways (8) reached. Cannot build more.`, 'warning');
            return;
        }
        
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
};

// Test the runway limit
console.log("=== RUNWAY LIMIT TEST ===");
console.log("Initial runway count:", gameState.buildings[0].owned);

// Try to buy 10 runways (should only be able to buy 8)
for (let i = 0; i < 10; i++) {
    console.log(`\nAttempting to buy runway #${i+1}:`);
    buyBuilding('runway');
    console.log("Current runway count:", gameState.buildings[0].owned);
}

console.log("\n=== TEST COMPLETE ===");
console.log("Final runway count:", gameState.buildings[0].owned);
console.log("Expected runway count: 8");
console.log("Test " + (gameState.buildings[0].owned === 8 ? "PASSED" : "FAILED"));