// Import dependencies for applyUpgrade functions
import { gameState } from './state.js';
import { addNotification } from './ui.js';

// Building definitions
export const buildingDefinitions = [
    {
        id: 'runway',
        name: 'Runway',
        description: 'Essential for flight operations. Each runway slightly increases money earned per flight.',
        baseCost: 150, // Increased cost
        // moneyPerSecond: 0, // Removed passive income
        // passengersPerSecond: 0, // Removed passive passengers
        moneyPerClickBoost: 0.1, // New: Each runway adds 10% to base click value
        owned: 0,
        unlocked: true
    },
    {
        id: 'terminal',
        name: 'Terminal',
        description: 'Processes passengers and generates passive income from concessions. Income scales with Reputation.',
        baseCost: 250, // Increased cost
        moneyPerSecondBase: 1.5, // Base passive income
        // passengersPerSecond: 0, // Removed passive passengers
        owned: 0,
        unlocked: true
    },
    {
        id: 'hangar',
        name: 'Hangar',
        description: 'Stores and maintains aircraft. May reduce operational costs or enable advanced features later.',
        baseCost: 600, // Increased cost
        // moneyPerSecond: 0, // Removed passive income
        // passengersPerSecond: 0, // Removed passive passengers
        owned: 0,
        unlocked: true // Keep unlocked initially? Or unlock later? Let's keep unlocked for now.
    },
    {
        id: 'control-tower',
        name: 'Control Tower',
        description: 'Manages air traffic, increasing the efficiency (money earned) of each runway.',
        baseCost: 3000, // Increased cost
        // moneyPerSecond: 0, // Removed passive income
        // passengersPerSecond: 0, // Removed passive passengers
        runwayEfficiencyBoost: 0.15, // New: Each tower adds 15% boost to runway moneyPerClickBoost
        owned: 0,
        unlocked: false // Unlocks at Level 2
    },
    {
        id: 'parking-garage',
        name: 'Parking Garage',
        description: 'Provides parking for passengers, generating passive income. Income scales with Reputation.',
        baseCost: 12000, // Increased cost
        moneyPerSecondBase: 30, // Base passive income
        // passengersPerSecond: 0, // Removed passive passengers
        owned: 0,
        unlocked: false // Unlocks at Level 3
    }
];

// Staff definitions
export const staffDefinitions = [
    {
        id: 'pilot',
        name: 'Pilot',
        description: 'Increases money earned per flight operation by 2%.',
        baseCost: 150, // Increased cost
        // clickMultiplier: 1.2, // Removed
        moneyPerClickBonus: 0.02, // New: +2% money per click per pilot
        owned: 0,
        unlocked: true
    },
    {
        id: 'flight-attendant',
        name: 'Flight Attendant',
        description: 'Slightly increases passive income from facilities by 1%.',
        baseCost: 400, // Increased cost
        // clickMultiplier: 1.5, // Removed
        passiveIncomeBonus: 0.01, // New: +1% passive income per attendant
        owned: 0,
        unlocked: true
    },
    {
        id: 'mechanic',
        name: 'Mechanic',
        description: 'Slightly increases passive income from facilities by 2%.',
        baseCost: 1500, // Increased cost
        // clickMultiplier: 2, // Removed
        passiveIncomeBonus: 0.02, // New: +2% passive income per mechanic
        owned: 0,
        unlocked: false // Unlocks at Level 2
    }
];

// Upgrade definitions
export const upgradeDefinitions = [
    {
        id: 'better-seats',
        name: 'Better Seats',
        description: 'Improves passenger comfort, increasing money earned per flight operation by 20%.',
        cost: 500, // Increased cost
        effect: '+20% Money per Flight Operation',
        purchased: false,
        unlocked: true,
        applyUpgrade: () => {
            // gameState.passengersPerClick *= 2; // Old effect
            if (!gameState.moneyPerClickMultiplier) gameState.moneyPerClickMultiplier = 1;
            gameState.moneyPerClickMultiplier += 0.20; // Additive bonus for now
            addNotification('Upgrade purchased: Better Seats (+20% Flight Revenue)', 'success');
        }
    },
    {
        id: 'faster-check-in',
        name: 'Faster Check-in',
        description: 'Speeds up passenger processing, increasing passive income from facilities by 15%.',
        cost: 1200, // Increased cost
        effect: '+15% Passive Income',
        purchased: false,
        unlocked: true,
        applyUpgrade: () => {
            // gameState.clickValue *= 1.5; // Old effect
            if (!gameState.passiveIncomeMultiplier) gameState.passiveIncomeMultiplier = 1;
            gameState.passiveIncomeMultiplier += 0.15; // Additive bonus for now
            addNotification('Upgrade purchased: Faster Check-in (+15% Passive Income)', 'success');
        }
    }
];
