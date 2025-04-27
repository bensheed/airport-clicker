// Import dependencies for applyUpgrade functions
import { gameState } from './state.js';
import { addNotification } from './ui.js';

// Building definitions
export const buildingDefinitions = [
    {
        id: 'runway',
        name: 'Runway',
        description: 'Allows planes to land and take off. Each runway multiplies the effectiveness of others! (Max: 8)',
        baseCost: 5,
        costScalingFactor: 2.5, // Special higher scaling factor for runways
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
export const staffDefinitions = [
    {
        id: 'pilot',
        name: 'Pilot',
        description: 'Flies the planes',
        baseCost: 25,
        clickMultiplier: 1.02, // Reduced from 1.2 to 1.02 (2% bonus)
        owned: 0,
        unlocked: true
    },
    {
        id: 'flight-attendant',
        name: 'Flight Attendant',
        description: 'Takes care of passengers',
        baseCost: 100,
        clickMultiplier: 1.05, // Reduced from 1.5 to 1.05 (5% bonus)
        owned: 0,
        unlocked: true
    },
    {
        id: 'mechanic',
        name: 'Mechanic',
        description: 'Maintains aircraft',
        baseCost: 500,
        clickMultiplier: 1.10, // Reduced from 2 to 1.10 (10% bonus)
        owned: 0,
        unlocked: false
    }
];

// Upgrade definitions
export const upgradeDefinitions = [
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
