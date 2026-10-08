// state.js — game state and persistence.
// This module is deliberately UI-free: it never touches the DOM and never
// imports ui.js, which keeps the module graph acyclic and lets tests import
// it under plain Node.

import { buildingDefinitions, staffDefinitions, upgradeDefinitions } from './definitions.js';
import {
    computeRates,
    levelForReputation,
    reputationForPassengers,
    BASE_CLICK_MONEY,
    BASE_CLICK_PASSENGERS,
} from './economy.js';

const SAVE_KEY = 'airportClickerSave';
const SAVE_VERSION = 2;

// Offline earnings: 50% of normal rates, capped at 4 hours away.
const OFFLINE_EFFICIENCY = 0.5;
const OFFLINE_CAP_SECONDS = 4 * 60 * 60;

// ---------- State ----------

export function createInitialState() {
    return {
        money: 0,
        passengers: 0,
        reputation: 0,
        totalFlights: 0,
        totalPassengers: 0,
        totalMoneyEarned: 0,
        airportLevel: 1,
        clickValue: BASE_CLICK_MONEY,
        passengersPerClick: BASE_CLICK_PASSENGERS,
        moneyPerSecond: 0,
        passengersPerSecond: 0,
        buildings: deepCopy(buildingDefinitions),
        staff: deepCopy(staffDefinitions),
        upgrades: deepCopy(upgradeDefinitions),
        activeEvents: [],   // [{ id, endsAt }]
        achievements: [],   // earned achievement ids
        buyQuantity: 1,     // 1 | 10 | 100 | 'max'
        clickCooldown: false,
    };
}

function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
}

export const gameState = createInitialState();

// Restore gameState to a fresh game (does not touch storage or the DOM).
export function resetState() {
    Object.assign(gameState, createInitialState());
}

// ---------- Persistence ----------

export function saveGame() {
    const stateToSave = {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        money: gameState.money,
        passengers: gameState.passengers,
        reputation: gameState.reputation,
        totalFlights: gameState.totalFlights,
        totalPassengers: gameState.totalPassengers,
        totalMoneyEarned: gameState.totalMoneyEarned,
        buyQuantity: gameState.buyQuantity,
        achievements: [...gameState.achievements],
        buildings: gameState.buildings.map(b => ({ id: b.id, owned: b.owned })),
        staff: gameState.staff.map(s => ({ id: s.id, owned: s.owned })),
        upgrades: gameState.upgrades.map(u => ({ id: u.id, purchased: u.purchased })),
    };

    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
        return true;
    } catch (e) {
        console.error('Failed to save game:', e);
        return false;
    }
}

// Loads saved state into gameState.
// Returns { loaded, migrated, offlineEarnings } — offlineEarnings is
// { money, passengers, seconds } or null. Never touches the DOM.
export function loadGame() {
    let parsed;
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return { loaded: false, migrated: false, offlineEarnings: null };
        parsed = JSON.parse(raw);
    } catch (e) {
        console.error('Failed to load game:', e);
        try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
        return { loaded: false, migrated: false, offlineEarnings: null };
    }

    // A syntactically valid save can still be unusable (e.g. the literal
    // `null`, or entries with hostile shapes) — treat it as corrupt.
    if (!parsed || typeof parsed !== 'object') {
        try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
        return { loaded: false, migrated: false, offlineEarnings: null };
    }

    const migrated = parsed.version !== SAVE_VERSION;
    try {
        applySavedState(parsed);
        reconcileUnlocks();

        const offlineEarnings = computeOfflineEarnings(parsed.savedAt);
        if (offlineEarnings) {
            gameState.money += offlineEarnings.money;
            gameState.passengers += offlineEarnings.passengers;
            gameState.totalPassengers += offlineEarnings.passengers;
            gameState.totalMoneyEarned += offlineEarnings.money;
        }
        return { loaded: true, migrated, offlineEarnings };
    } catch (e) {
        console.error('Failed to apply save:', e);
        try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
        resetState();
        return { loaded: false, migrated: false, offlineEarnings: null };
    }
}

// Merges a parsed save (v1 or v2) into the live gameState.
function applySavedState(saved) {
    // clickValue/passengersPerClick stay at their base values — upgrade
    // bonuses are computed from purchased flags, not stored in the base.
    const scalarProps = [
        'money', 'passengers', 'reputation', 'totalFlights', 'totalPassengers',
        'totalMoneyEarned',
    ];
    for (const prop of scalarProps) {
        if (typeof saved[prop] === typeof gameState[prop]) {
            gameState[prop] = saved[prop];
        }
    }

    // buyQuantity is numeric (1/10/100) or the string 'max' — the generic
    // type-check above would reject 'max' against the numeric default.
    if (saved.buyQuantity === 'max' || (typeof saved.buyQuantity === 'number' && saved.buyQuantity >= 1)) {
        gameState.buyQuantity = saved.buyQuantity;
    }

    // Level is recomputed in reconcileUnlocks (below) rather than
    // trusting the save — thresholds may have changed between versions.

    for (const key of ['buildings', 'staff']) {
        if (!Array.isArray(saved[key])) continue;
        for (const item of gameState[key]) {
            const savedItem = saved[key].find(i => i.id === item.id);
            if (savedItem && typeof savedItem.owned === 'number') {
                item.owned = Math.max(0, Math.floor(savedItem.owned));
            }
        }
    }

    if (Array.isArray(saved.upgrades)) {
        for (const upgrade of gameState.upgrades) {
            const savedUpgrade = saved.upgrades.find(u => u.id === upgrade.id);
            if (savedUpgrade && savedUpgrade.purchased === true) {
                upgrade.purchased = true;
            }
        }
    }

    if (Array.isArray(saved.achievements)) {
        gameState.achievements = saved.achievements.filter(id => typeof id === 'string');
    }
}

// Unlocked flags are derived from the final level (definitions carry
// unlockLevel), so settle reputation/level BEFORE computing them —
// saved passengers can imply a higher level than saved reputation
// (older saves used a different passengers-per-reputation rate).
function reconcileUnlocks() {
    gameState.reputation = Math.max(gameState.reputation, reputationForPassengers(gameState.totalPassengers));
    gameState.airportLevel = levelForReputation(gameState.reputation);
    const level = gameState.airportLevel;
    for (const list of [gameState.buildings, gameState.staff, gameState.upgrades]) {
        for (const item of list) {
            item.unlocked = level >= (item.unlockLevel || 1);
        }
    }
}

function computeOfflineEarnings(savedAt) {
    if (typeof savedAt !== 'number' || savedAt <= 0) return null;
    const elapsedSeconds = Math.floor((Date.now() - savedAt) / 1000);
    // Not worth reporting under a minute.
    if (elapsedSeconds < 60) return null;

    const effectiveSeconds = Math.min(elapsedSeconds, OFFLINE_CAP_SECONDS);
    const rates = computeRates(gameState);
    if (rates.moneyPerSecond <= 0 && rates.passengersPerSecond <= 0) return null;

    return {
        money: rates.moneyPerSecond * effectiveSeconds * OFFLINE_EFFICIENCY,
        passengers: rates.passengersPerSecond * effectiveSeconds * OFFLINE_EFFICIENCY,
        seconds: elapsedSeconds,
        capped: elapsedSeconds > OFFLINE_CAP_SECONDS,
    };
}
