// Import functions to test (adjust path if needed)
// Note: We might need to use module exports/imports or other techniques
// if the original game.js doesn't export functions easily.
// For now, let's assume we can somehow access the functions.

// Mock gameState and necessary DOM functions if needed
const gameState = {
    money: 100,
    buildings: [
        { id: 'runway', name: 'Runway', baseCost: 10, owned: 0, unlocked: true, moneyPerSecond: 0.5, passengersPerSecond: 0.2, description: 'Desc' },
        { id: 'terminal', name: 'Terminal', baseCost: 50, owned: 0, unlocked: true, moneyPerSecond: 2, passengersPerSecond: 1, description: 'Desc' }
    ],
    // Add other relevant state properties if needed
    reputation: 0,
    totalPassengers: 0,
    airportLevel: 1
};

// Mock functions that interact with the DOM or have side effects
const updateResourceDisplay = jest.fn();
const renderBuildings = jest.fn();
const renderStaff = jest.fn();
const renderUpgrades = jest.fn();
const addNotification = jest.fn();
const updateTabBadges = jest.fn();

// Replace actual functions with mocks for testing environment
global.updateResourceDisplay = updateResourceDisplay;
global.renderBuildings = renderBuildings;
global.renderStaff = renderStaff;
global.renderUpgrades = renderUpgrades;
global.addNotification = addNotification;
global.updateTabBadges = updateTabBadges;

// TODO: Need to properly load game.js and its functions/state for testing.
// This might involve refactoring game.js or using tools like JSDOM.
// For now, we'll define a mock buyBuilding based on the original code.

function buyBuilding(buildingId) {
    const building = gameState.buildings.find(b => b.id === buildingId);

    if (building) {
        const cost = Math.floor(building.baseCost * Math.pow(1.15, building.owned));

        if (gameState.money >= cost) {
            gameState.money -= cost;
            building.owned += 1;

            addNotification(`Purchased a ${building.name}`, 'success');

            // Update display
            updateResourceDisplay();
            renderBuildings();

            // Re-render staff and upgrades to update their buy buttons too
            renderStaff();
            renderUpgrades();
            updateTabBadges();
        } else {
            console.log(`Cannot afford ${building.name}. Cost: $${cost}, Money: ${gameState.money}`);
        }
    }
}


describe('buyBuilding', () => {
    beforeEach(() => {
        // Reset gameState and mocks before each test
        gameState.money = 100;
        gameState.buildings = [
            { id: 'runway', name: 'Runway', baseCost: 10, owned: 0, unlocked: true, moneyPerSecond: 0.5, passengersPerSecond: 0.2, description: 'Desc' },
            { id: 'terminal', name: 'Terminal', baseCost: 50, owned: 0, unlocked: true, moneyPerSecond: 2, passengersPerSecond: 1, description: 'Desc' }
        ];
        jest.clearAllMocks();
    });

    test('should buy a building if enough money', () => {
        buyBuilding('runway');
        const runway = gameState.buildings.find(b => b.id === 'runway');
        expect(gameState.money).toBe(90); // 100 - 10
        expect(runway.owned).toBe(1);
        expect(addNotification).toHaveBeenCalledWith('Purchased a Runway', 'success');
        expect(updateResourceDisplay).toHaveBeenCalled();
        expect(renderBuildings).toHaveBeenCalled();
        expect(renderStaff).toHaveBeenCalled();
        expect(renderUpgrades).toHaveBeenCalled();
        expect(updateTabBadges).toHaveBeenCalled();

        // Try buying another one
        buyBuilding('runway');
        const cost = Math.floor(10 * Math.pow(1.15, 1)); // Cost increases
        expect(gameState.money).toBe(90 - cost); // 90 - 11 = 79
        expect(runway.owned).toBe(2);
    });

    test('should not buy a building if not enough money', () => {
        gameState.money = 5; // Not enough for a runway (cost 10)
        buyBuilding('runway');
        const runway = gameState.buildings.find(b => b.id === 'runway');
        expect(gameState.money).toBe(5);
        expect(runway.owned).toBe(0);
        expect(addNotification).not.toHaveBeenCalled();
        expect(updateResourceDisplay).not.toHaveBeenCalled();
        expect(renderBuildings).not.toHaveBeenCalled();
    });

    test('should buy a different building', () => {
        buyBuilding('terminal');
        const terminal = gameState.buildings.find(b => b.id === 'terminal');
        expect(gameState.money).toBe(50); // 100 - 50
        expect(terminal.owned).toBe(1);
        expect(addNotification).toHaveBeenCalledWith('Purchased a Terminal', 'success');
    });

     test('should handle buying a non-existent building gracefully', () => {
        // Spy on console.log to check for error messages if any
        const consoleSpy = jest.spyOn(console, 'log');
        buyBuilding('non-existent-building');
        expect(gameState.money).toBe(100); // Money should not change
        expect(addNotification).not.toHaveBeenCalled();
        expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Cannot afford'));
        consoleSpy.mockRestore(); // Clean up the spy
    });
});
