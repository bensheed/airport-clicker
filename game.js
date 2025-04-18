// Import necessary modules
import { buildingDefinitions, staffDefinitions, upgradeDefinitions } from './js/modules/definitions.js';
import { gameState, loadGame, resetProgress, saveGame } from './js/modules/state.js'; // Added saveGame import
import { 
    updateResourceDisplay, 
    renderBuildings, 
    renderStaff, 
    renderUpgrades, 
    updateButtonStates, 
    updateTabBadges, 
    switchTab, 
    addNotification, 
    renderLevelUnlocks // Added import
} from './js/modules/ui.js';
import { handleMainClick, gameLoop } from './js/modules/gameLogic.js';

// Initialize game
function initGame() {
    // Initialize gameState with deep copies of definitions
    // Ensure this happens before loadGame attempts to merge state
    gameState.buildings = JSON.parse(JSON.stringify(buildingDefinitions)); 
    gameState.staff = JSON.parse(JSON.stringify(staffDefinitions));
    gameState.upgrades = JSON.parse(JSON.stringify(upgradeDefinitions));

    // Attempt to load saved game state
    const loaded = loadGame(); // loadGame modifies gameState directly

    // Render initial UI based on loaded or default state
    updateResourceDisplay();
    renderBuildings();
    renderStaff();
    renderUpgrades();
    updateButtonStates(); 
    renderLevelUnlocks();
    updateTabBadges(); 

    // Set up event listeners
    console.log('Setting up event listeners...');
    const mainClicker = document.getElementById('main-clicker');
    if (mainClicker) {
        console.log('Attaching listener to main-clicker');
        mainClicker.addEventListener('click', handleMainClick);
    } else {
        console.error('Main clicker button not found!');
    }

    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        console.log(`Attaching listener to tab button for: ${button.getAttribute('data-tab')}`);
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            if (tabId) {
                switchTab(tabId);
            }
        });
    });

    const resetButton = document.getElementById('reset-progress-button');
    if (resetButton) {
        resetButton.addEventListener('click', resetProgress);
    } else {
        // It's okay if the reset button isn't found, maybe it's optional
        // console.warn('Reset button not found!'); 
    }

    // Start game loop
    setInterval(gameLoop, 1000);
    
    // Welcome / Load notification
    if (!loaded) {
        addNotification('Welcome to Airport Clicker! Click "Operate Flight" to start earning money.', 'info');
    } else {
        addNotification('Game progress loaded.', 'info');
    }

    // Initial tab setup (optional, default to first tab)
    // switchTab('buildings'); 
}

// Initialize the game when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initGame);

// Optional: Add a beforeunload listener to save the game when the user leaves
window.addEventListener('beforeunload', () => {
    saveGame();
});
