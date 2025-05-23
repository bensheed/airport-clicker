// Import game state and logic functions (placeholders)
import { gameState } from './state.js';
import { buyBuilding, hireStaff, purchaseUpgrade } from './gameLogic.js'; // Assuming these will be in gameLogic.js

// Update resource display in the UI
export function updateResourceDisplay() {
    const moneyEl = document.getElementById('money');
    const passengersEl = document.getElementById('passengers');
    const reputationEl = document.getElementById('reputation');
    const totalFlightsEl = document.getElementById('total-flights');
    const totalPassengersEl = document.getElementById('total-passengers');
    const airportLevelEl = document.getElementById('airport-level');
    const levelProgressBar = document.getElementById('level-progress-bar');
    const levelProgressText = document.getElementById('level-progress-text');

    if (moneyEl) moneyEl.textContent = gameState.money.toFixed(1);
    if (passengersEl) passengersEl.textContent = gameState.passengers.toFixed(0);
    if (reputationEl) reputationEl.textContent = gameState.reputation.toFixed(0);
    if (totalFlightsEl) totalFlightsEl.textContent = gameState.totalFlights;
    if (totalPassengersEl) totalPassengersEl.textContent = gameState.totalPassengers.toFixed(0);
    if (airportLevelEl) airportLevelEl.textContent = gameState.airportLevel;

    // Update Level Progress Bar
    if (levelProgressBar && levelProgressText) {
        const currentLevelRep = gameState.reputation % 10;
        const repNeeded = 10;
        levelProgressBar.value = currentLevelRep;
        levelProgressBar.max = repNeeded;
        levelProgressText.textContent = `${currentLevelRep}/${repNeeded} Rep`;
    }
}

// Define level unlocks (could be moved to definitions.js later)
const levelUnlocks = {
    2: ['Control Tower', 'Mechanic'],
    3: ['Parking Garage'],
    // Add more levels as needed
};

// Render level unlock information in the Stats tab
export function renderLevelUnlocks() {
    console.log("Attempting to render level unlocks...");
    const unlockListEl = document.getElementById('level-unlocks-list');
    if (!unlockListEl) {
        console.error("#level-unlocks-list element not found!");
        return;
    }

    let unlockHtml = '<h3>Level Unlocks</h3><ul>';
    console.log("Initial unlockHtml:", unlockHtml);
    try {
        for (const level in levelUnlocks) {
            console.log(`Processing level: ${level}`);
            const unlocks = levelUnlocks[level];
            if (Array.isArray(unlocks)) {
                const joinedUnlocks = unlocks.join(', ');
                console.log(`  Unlocks for level ${level}: ${joinedUnlocks}`);
                unlockHtml += `<li>Level ${level}: ${joinedUnlocks}</li>`;
            } else {
                console.warn(`  Data for level ${level} is not an array:`, unlocks);
            }
        }
        unlockHtml += '</ul>';
        console.log("Final unlockHtml:", unlockHtml);
        unlockListEl.innerHTML = unlockHtml;
    } catch (error) {
        console.error("Error during unlock list generation:", error);
        unlockListEl.innerHTML = '<h3>Error loading unlocks</h3>'; // Show error in UI
    }
}

// Render buildings tab content
export function renderBuildings() {
    const buildingList = document.querySelector('.building-list');
    if (!buildingList) return;
    buildingList.innerHTML = '';

    gameState.buildings.forEach(building => {
        // Removed outer unlocked check - render all, style locked ones
            // Use custom scaling factor for runways if available, otherwise use default 1.15
            const scalingFactor = building.id === 'runway' ? (building.costScalingFactor || 2.5) : 1.15;
            const buildingCost = Math.floor(building.baseCost * Math.pow(scalingFactor, building.owned));
            const canAfford = gameState.money >= buildingCost;
            const isLocked = !building.unlocked;
            // Check if this is a runway and if we've reached the maximum
            const isMaxRunways = building.id === 'runway' && building.owned >= 8;

            // Debug logging for runway
            if (building.id === 'runway') {
                console.log(`[UI] Rendering runway: owned=${building.owned}, cost=$${buildingCost}, canAfford=${canAfford}, money=$${gameState.money}`);
            }

            const buildingElement = document.createElement('div');
            buildingElement.className = `building-item ${isLocked ? 'locked' : ''}`;
            let unlockLevel = '?'; // Determine unlock level (can be improved)
            if (building.id === 'control-tower') unlockLevel = '2';
            if (building.id === 'parking-garage') unlockLevel = '3';
            const lockText = isLocked ? `<span>(Locked - Lvl ${unlockLevel})</span>` : '';
            let productionText = '';
            
            if (building.id === 'runway') {
                // For runways, show the compounding effect
                const runwayEffectiveness = building.owned > 0 ? Math.pow(1.5, building.owned) - 1 : 0;
                const effectiveMoneyPerSecond = (building.moneyPerSecond || 0) * building.owned * (1 + runwayEffectiveness);
                const effectivePassengersPerSecond = (building.passengersPerSecond || 0) * building.owned * (1 + runwayEffectiveness);
                
                productionText = `Produces: $${effectiveMoneyPerSecond.toFixed(1)}/s, ${effectivePassengersPerSecond.toFixed(1)} passengers/s`;
                
                // Add multiplier info
                if (building.owned > 0) {
                    const multiplier = Math.pow(1.2, building.owned).toFixed(2);
                    productionText += `<br>All other buildings get a ${multiplier}x multiplier!`;
                }
            } else {
                // For other buildings, show base production
                productionText = `Produces: $${building.moneyPerSecond || 0}/s, ${building.passengersPerSecond || 0} passengers/s`;
                
                // If runways exist, show the multiplied value too
                const runway = gameState.buildings.find(b => b.id === 'runway');
                if (runway && runway.owned > 0) {
                    const multiplier = Math.pow(1.2, runway.owned);
                    const boostedMoney = (building.moneyPerSecond || 0) * multiplier;
                    const boostedPassengers = (building.passengersPerSecond || 0) * multiplier;
                    productionText += `<br>With runway bonus: $${boostedMoney.toFixed(1)}/s, ${boostedPassengers.toFixed(1)} passengers/s`;
                }
            }

            buildingElement.innerHTML = `
                <div class="building-name">${building.name} (${building.owned})</div> 
                <div class="building-cost">Cost: $${buildingCost}</div>
                <div class="building-description">${building.description}</div>
                <div class="building-production">${productionText}</div>
                <button class="buy-button" data-building="${building.id}" ${isLocked || !canAfford || isMaxRunways ? 'disabled' : ''}>
                    ${isLocked ? `Locked (Lvl ${unlockLevel})` : (isMaxRunways ? 'Max Reached' : 'Buy')}
                </button>
            `;

            buildingList.appendChild(buildingElement);

            // Add event listener only if NOT locked
            if (!isLocked) {
                const buyButton = buildingElement.querySelector('.buy-button');
                if (buyButton) {
                    buyButton.addEventListener('click', () => {
                        console.log(`[UI] Buy button clicked for ${building.id}. Current owned: ${building.owned}, Cost: $${buildingCost}`);
                        buyBuilding(building.id); // Needs gameLogic.js
                    });
                }
            }
    });
}

// Render staff tab content
export function renderStaff() {
    const staffList = document.querySelector('.staff-list');
    if (!staffList) return;
    staffList.innerHTML = '';

    gameState.staff.forEach(staff => {
        // Removed outer unlocked check
            const staffCost = Math.floor(staff.baseCost * Math.pow(1.2, staff.owned));
            const canAfford = gameState.money >= staffCost;
            const isLocked = !staff.unlocked;

            const staffElement = document.createElement('div');
            staffElement.className = `staff-item ${isLocked ? 'locked' : ''}`;
            let unlockLevel = '?';
            if (staff.id === 'mechanic') unlockLevel = '2';
            const lockText = isLocked ? `<span>(Locked - Lvl ${unlockLevel})</span>` : '';
            const bonusText = `Click Bonus: ${((staff.clickMultiplier - 1) * 100).toFixed(0)}% per ${staff.name}`; // Using original logic

            staffElement.innerHTML = `
                <div class="staff-name">${staff.name} (${staff.owned})</div>
                <div class="staff-cost">Cost: $${staffCost}</div>
                <div class="staff-description">${staff.description}</div>
                <div class="staff-bonus">${bonusText}</div>
                <button class="buy-button" data-staff="${staff.id}" ${isLocked || !canAfford ? 'disabled' : ''}>${isLocked ? `Locked (Lvl ${unlockLevel})` : 'Hire'}</button>
            `;

            staffList.appendChild(staffElement);

            // Add event listener only if NOT locked
            if (!isLocked) {
                const buyButton = staffElement.querySelector('.buy-button');
                if (buyButton) {
                    buyButton.addEventListener('click', () => {
                        hireStaff(staff.id); // Needs gameLogic.js
                    });
                }
            }
    });
}

// Render upgrades tab content
export function renderUpgrades() {
    const upgradeList = document.querySelector('.upgrade-list');
    if (!upgradeList) return;
    upgradeList.innerHTML = ''; // Clear existing items

    gameState.upgrades.forEach(upgrade => {
        // Removed outer unlocked check
            const canAfford = gameState.money >= upgrade.cost;
            const isPurchased = upgrade.purchased;
            const isLocked = !upgrade.unlocked;

            const upgradeElement = document.createElement('div');
            // Add 'purchased' and 'locked' classes
            upgradeElement.className = `upgrade-item ${isPurchased ? 'purchased' : ''} ${isLocked ? 'locked' : ''}`;

            const lockText = isLocked ? `<span>(Locked)</span>` : ''; // No level info for upgrades yet

            upgradeElement.innerHTML = `
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-cost">Cost: $${upgrade.cost}</div>
                <div class="upgrade-description">${upgrade.description}</div>
                <div class="upgrade-effect">${upgrade.effect}</div>
                <button class="buy-button" data-upgrade="${upgrade.id}" ${isLocked || isPurchased || !canAfford ? 'disabled' : ''}>
                    ${isLocked ? 'Locked' : (isPurchased ? 'Purchased' : 'Purchase')} 
                </button>
            `;

            upgradeList.appendChild(upgradeElement);

            // Add event listener only if NOT locked and NOT purchased
            if (!isLocked && !isPurchased) {
                const buyButton = upgradeElement.querySelector('.buy-button');
                if (buyButton) {
                    buyButton.addEventListener('click', () => {
                        purchaseUpgrade(upgrade.id); // Needs gameLogic.js
                    });
                }
            }
    });
}

// Update the enabled/disabled state of buy/hire buttons
export function updateButtonStates() {
    const currentMoney = gameState.money;
    const buttons = document.querySelectorAll('.buy-button');

    buttons.forEach(button => {
        let item;
        let cost;
        let isLocked = false; 
        let isPurchased = false; // Declare isPurchased here

        const buildingId = button.getAttribute('data-building');
        const staffId = button.getAttribute('data-staff');
        const upgradeId = button.getAttribute('data-upgrade');

        if (buildingId) {
            item = gameState.buildings.find(b => b.id === buildingId);
            if (item) {
                // Use custom scaling factor for runways if available, otherwise use default 1.15
                const scalingFactor = item.id === 'runway' ? (item.costScalingFactor || 2.5) : 1.15;
                cost = Math.floor(item.baseCost * Math.pow(scalingFactor, item.owned));
                isLocked = !item.unlocked;
                // Check for runway limit
                if (item.id === 'runway' && item.owned >= 8) {
                    button.disabled = true;
                    button.textContent = 'Max Reached';
                    return; // Skip the rest of the logic for this button
                }
            }
        } else if (staffId) {
            item = gameState.staff.find(s => s.id === staffId);
            if (item) {
                cost = Math.floor(item.baseCost * Math.pow(1.2, item.owned));
                isLocked = !item.unlocked;
            }
        } else if (upgradeId) {
            item = gameState.upgrades.find(u => u.id === upgradeId);
            if (item) {
                cost = item.cost;
                isPurchased = item.purchased;
                isLocked = !item.unlocked;
            }
        }

        if (item) {
            // Disable if locked, purchased (for upgrades), or if cannot afford
            button.disabled = isLocked || isPurchased || currentMoney < cost;
        } else {
            // If item not found for some reason, disable the button
            button.disabled = true;
        }
    });
}

// Update tab badges based on affordability and active tab
export function updateTabBadges() {
    const currentMoney = gameState.money;
    const activeTabId = document.querySelector('.tab-pane.active')?.id;
    console.log(`[Badge] Updating badges. Active tab: ${activeTabId}, Money: $${currentMoney}`);

    // Check Buildings
    const canAffordBuilding = gameState.buildings.some(b => {
        if (!b.unlocked) return false;
        // Use custom scaling factor for runways if available, otherwise use default 1.15
        const scalingFactor = b.id === 'runway' ? (b.costScalingFactor || 2.5) : 1.15;
        // Check if this is a runway and if we've reached the maximum
        if (b.id === 'runway' && b.owned >= 8) return false;
        const cost = Math.floor(b.baseCost * Math.pow(scalingFactor, b.owned));
        const canAfford = currentMoney >= cost;
        console.log(`[Badge] Building ${b.id}: unlocked=${b.unlocked}, cost=$${cost}, canAfford=${canAfford}`);
        return canAfford;
    });
    const buildingTabButton = document.querySelector('.tab-button[data-tab="buildings"] .badge');
    if (buildingTabButton) {
        // Only show badge if we can afford a building AND we're not on the buildings tab
        const shouldShowBadge = canAffordBuilding && activeTabId !== 'buildings';
        console.log(`[Badge] Buildings tab badge visible: ${shouldShowBadge}`);
        buildingTabButton.classList.toggle('visible', shouldShowBadge);
    }

    // Check Staff
    const canAffordStaff = gameState.staff.some(s => {
        if (!s.unlocked) return false;
        const cost = Math.floor(s.baseCost * Math.pow(1.2, s.owned));
        const canAfford = currentMoney >= cost;
        console.log(`[Badge] Staff ${s.id}: unlocked=${s.unlocked}, cost=$${cost}, canAfford=${canAfford}`);
        return canAfford;
    });
    const staffTabButton = document.querySelector('.tab-button[data-tab="staff"] .badge');
    if (staffTabButton) {
        // Only show badge if we can afford staff AND we're not on the staff tab
        const shouldShowBadge = canAffordStaff && activeTabId !== 'staff';
        console.log(`[Badge] Staff tab badge visible: ${shouldShowBadge}`);
        staffTabButton.classList.toggle('visible', shouldShowBadge);
    }

    // Check Upgrades
    const canAffordUpgrade = gameState.upgrades.some(u => {
        if (!u.unlocked || u.purchased) return false;
        const canAfford = currentMoney >= u.cost;
        console.log(`[Badge] Upgrade ${u.id}: unlocked=${u.unlocked}, purchased=${u.purchased}, cost=$${u.cost}, canAfford=${canAfford}`);
        return canAfford;
    });
    const upgradeTabButton = document.querySelector('.tab-button[data-tab="upgrades"] .badge');
    if (upgradeTabButton) {
        // Only show badge if we can afford an upgrade AND we're not on the upgrades tab
        const shouldShowBadge = canAffordUpgrade && activeTabId !== 'upgrades';
        console.log(`[Badge] Upgrades tab badge visible: ${shouldShowBadge}`);
        upgradeTabButton.classList.toggle('visible', shouldShowBadge);
    }
}

// Switch between tabs in the UI
export function switchTab(tabId) {
    console.log(`switchTab called with tabId: ${tabId}`);
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
    const selectedPane = document.getElementById(tabId);
    if (selectedPane) {
        selectedPane.classList.add('active');
    }

    // Activate selected tab button
    const selectedButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (selectedButton) {
        selectedButton.classList.add('active');
    }
    updateTabBadges(); // Update badges after tab switch
}

// Add a notification message to the UI
export function addNotification(message, type = 'info') {
    const notificationList = document.getElementById('notification-list');
    if (!notificationList) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    // Make newer notifications appear at the top
    notificationList.prepend(notification);

    // Limit to a reasonable number (e.g., 10) notifications
    const notifications = notificationList.querySelectorAll('.notification');
    if (notifications.length > 10) {
        notifications[notifications.length - 1].remove();
    }
}

// Show floating feedback text when clicking the main button
export function showClickFeedback(text) {
    const feedbackContainer = document.getElementById('click-feedback');
    if (!feedbackContainer) return;

    const feedback = document.createElement('div');
    feedback.className = 'click-feedback-item';
    feedback.textContent = text;

    feedbackContainer.appendChild(feedback);

    // Remove after animation completes
    setTimeout(() => {
        feedback.remove();
    }, 1500);
}
