// gameLogic.js — game rules: clicks, passive income, purchases,
// level-ups, random events, achievements, save lifecycle.
// Imports the DOM-touching functions from ui.js; ui.js never imports
// this module (handlers are injected via initUI), so the module
// graph is acyclic.

import { gameState, saveGame, resetState } from './state.js';
import {
    eventDefinitions,
    achievementDefinitions,
    EVENT_MIN_INTERVAL,
    EVENT_MAX_INTERVAL,
    SECURITY_EVENT_REDUCTION,
} from './definitions.js';
import {
    getBulkCost,
    getMaxAffordable,
    getBuildingScaling,
    getEventModifiers,
    computeRates,
    computeClickValue,
    isAchievementEarned,
    reputationForPassengers,
    levelForReputation,
    MAX_RUNWAYS,
    STAFF_COST_SCALING,
} from './economy.js';
import {
    updateResourceDisplay,
    showClickFeedback,
    renderBuildings,
    renderStaff,
    renderUpgrades,
    renderAchievements,
    renderStats,
    renderEventBanner,
    renderLevelUnlocks,
    addNotification,
    updateButtonStates,
    updateTabBadges,
    updateQuantitySelector,
    refreshAll,
} from './ui.js';

const TICK_MS = 1000;
const AUTOSAVE_TICKS = 15;
const CLICK_COOLDOWN_MS = 80;

let lastTickTime = Date.now();
let nextEventAt = 0;
let ticksSinceSave = 0;

// ---------- Main click ----------

export function handleMainClick() {
    if (gameState.clickCooldown) return;
    gameState.clickCooldown = true;
    setTimeout(() => { gameState.clickCooldown = false; }, CLICK_COOLDOWN_MS);

    const { money, passengers } = computeClickValue(gameState);

    gameState.money += money;
    gameState.passengers += passengers;
    gameState.totalFlights += 1;
    gameState.totalPassengers += passengers;
    gameState.totalMoneyEarned += money;
    syncReputation();

    updateResourceDisplay();
    showClickFeedback(money, passengers);
    updateButtonStates();
    updateTabBadges();
    renderStats();
    checkLevelUp();
    checkAchievements();
}

// ---------- Game loop ----------

export function startGameLoop() {
    lastTickTime = Date.now();
    scheduleNextEvent(Date.now() + 30000); // first event after ~30s+
    return setInterval(gameLoop, TICK_MS);
}

export function gameLoop() {
    const now = Date.now();
    // Delta-time accrual: background tab throttling still credits correctly.
    const deltaSeconds = Math.max(0, (now - lastTickTime) / 1000);
    lastTickTime = now;

    accruePassiveIncome(deltaSeconds, now);

    // Expire/spawn only after the elapsed interval has been credited so a
    // new event can't retro-modify time before it started.
    expireEvents(now);
    maybeSpawnEvent(now);

    const eventMods = getEventModifiers(gameState.activeEvents, eventDefinitions, now);
    const rates = computeRates(gameState, eventMods);
    gameState.moneyPerSecond = rates.moneyPerSecond;
    gameState.passengersPerSecond = rates.passengersPerSecond;

    updateResourceDisplay();
    updateButtonStates();
    updateTabBadges();
    renderEventBanner(); // countdown seconds tick down
    renderStats(); // keep an open Stats tab live
    checkLevelUp();
    checkAchievements();

    if (++ticksSinceSave >= AUTOSAVE_TICKS) {
        ticksSinceSave = 0;
        saveGame();
    }
}

// Credit elapsed production in segments split at timed-event boundaries.
// A throttled tick can span an event's start/end; applying one end-state
// modifier to the whole interval would misprice the elapsed time.
function accruePassiveIncome(deltaSeconds, now) {
    let cursor = now - deltaSeconds * 1000;
    let remaining = deltaSeconds;
    while (remaining > 0) {
        const mods = getEventModifiers(gameState.activeEvents, eventDefinitions, cursor);
        let boundary = now;
        for (const e of gameState.activeEvents) {
            if (e.endsAt > cursor && e.endsAt < boundary) boundary = e.endsAt;
        }
        const segSeconds = Math.min(remaining, Math.max(0, (boundary - cursor) / 1000));
        if (segSeconds <= 0) break;
        const rates = computeRates(gameState, mods);
        gameState.money += rates.moneyPerSecond * segSeconds;
        gameState.passengers += rates.passengersPerSecond * segSeconds;
        gameState.totalPassengers += rates.passengersPerSecond * segSeconds;
        gameState.totalMoneyEarned += rates.moneyPerSecond * segSeconds;
        cursor += segSeconds * 1000;
        remaining -= segSeconds;
    }
    syncReputation();
}

function syncReputation() {
    gameState.reputation = reputationForPassengers(gameState.totalPassengers);
}

// ---------- Levels & unlocks ----------

export function checkLevelUp() {
    syncReputation();
    const newLevel = levelForReputation(gameState.reputation);
    if (newLevel <= gameState.airportLevel) return;

    gameState.airportLevel = newLevel;
    const unlocked = applyUnlocks();
    addNotification(`Your airport reached level ${newLevel}!`, 'success');
    for (const name of unlocked) {
        addNotification(`Unlocked: ${name}`, 'info');
    }
    renderLevelUnlocks();
    refreshShopTabs();
}

// Unlock every definition whose unlockLevel is met; returns names
// of items unlocked by this call.
function applyUnlocks() {
    const newlyUnlocked = [];
    for (const list of [gameState.buildings, gameState.staff, gameState.upgrades]) {
        for (const item of list) {
            if (!item.unlocked && gameState.airportLevel >= (item.unlockLevel || 1)) {
                item.unlocked = true;
                newlyUnlocked.push(item.name);
            }
        }
    }
    return newlyUnlocked;
}

// ---------- Purchases ----------

function refreshShopTabs() {
    renderBuildings();
    renderStaff();
    renderUpgrades();
    updateButtonStates();
    updateTabBadges();
}

// How many units the current buy-quantity selector resolves to for an item.
function resolveQuantity(baseCost, scaling, owned, cap = Infinity) {
    const qty = gameState.buyQuantity;
    if (qty === 'max') {
        return Math.max(1, getMaxAffordable(baseCost, scaling, owned, gameState.money, cap));
    }
    return Math.min(qty, cap);
}

export function buyBuilding(buildingId) {
    const building = gameState.buildings.find(b => b.id === buildingId);
    if (!building) return false;

    if (!building.unlocked) {
        addNotification(`${building.name} is locked until level ${building.unlockLevel}.`, 'warning');
        return false;
    }

    const cap = building.id === 'runway' ? MAX_RUNWAYS : Infinity;
    const remaining = cap - building.owned;
    if (remaining <= 0) {
        addNotification(`Maximum number of runways (${MAX_RUNWAYS}) reached.`, 'warning');
        return false;
    }

    const scaling = getBuildingScaling(building);
    const qty = resolveQuantity(building.baseCost, scaling, building.owned, remaining);
    const cost = getBulkCost(building.baseCost, scaling, building.owned, qty);

    if (gameState.money < cost) {
        addNotification(`Not enough money for ${qty} × ${building.name}`, 'warning');
        return false;
    }

    gameState.money -= cost;
    building.owned += qty;
    addNotification(qty > 1 ? `Built ${qty} × ${building.name}` : `Built a ${building.name}`, 'success');

    updateResourceDisplay();
    refreshShopTabs();
    renderStats();
    saveGame();
    return true;
}

export function hireStaff(staffId) {
    const staff = gameState.staff.find(s => s.id === staffId);
    if (!staff) return false;

    if (!staff.unlocked) {
        addNotification(`${staff.name} is locked until level ${staff.unlockLevel}.`, 'warning');
        return false;
    }

    const qty = resolveQuantity(staff.baseCost, STAFF_COST_SCALING, staff.owned);
    const cost = getBulkCost(staff.baseCost, STAFF_COST_SCALING, staff.owned, qty);
    if (gameState.money < cost) {
        addNotification(`Not enough money for ${staff.name}`, 'warning');
        return false;
    }

    gameState.money -= cost;
    staff.owned += qty;
    addNotification(qty > 1 ? `Hired ${qty} × ${staff.name}` : `Hired a ${staff.name}`, 'success');

    updateResourceDisplay();
    refreshShopTabs();
    renderStats();
    saveGame();
    return true;
}

export function purchaseUpgrade(upgradeId) {
    const upgrade = gameState.upgrades.find(u => u.id === upgradeId);
    if (!upgrade) {
        console.error(`Upgrade with ID ${upgradeId} not found.`);
        return false;
    }
    if (!upgrade.unlocked) {
        addNotification(`${upgrade.name} is locked until level ${upgrade.unlockLevel}.`, 'warning');
        return false;
    }
    if (upgrade.purchased) return false;

    if (gameState.money < upgrade.cost) {
        addNotification(`Not enough money for ${upgrade.name}`, 'warning');
        return false;
    }

    gameState.money -= upgrade.cost;
    upgrade.purchased = true;
    // Effects are data (upgrade.effect) folded into computeMultipliers —
    // nothing else to apply, so JSON save/load can't strip them.
    addNotification(`Upgrade purchased: ${upgrade.name} — ${upgrade.effectText}`, 'success');

    updateResourceDisplay();
    refreshShopTabs();
    renderStats();
    checkAchievements();
    saveGame();
    return true;
}

export function setBuyQuantity(qty) {
    gameState.buyQuantity = qty;
    updateQuantitySelector();
    refreshShopTabs();
}

// ---------- Events ----------

function scheduleNextEvent(now) {
    nextEventAt = now + (EVENT_MIN_INTERVAL + Math.random() * (EVENT_MAX_INTERVAL - EVENT_MIN_INTERVAL)) * 1000;
}

function expireEvents(now) {
    const before = gameState.activeEvents.length;
    gameState.activeEvents = gameState.activeEvents.filter(e => e.endsAt > now);
    if (gameState.activeEvents.length !== before) renderEventBanner();
}

function maybeSpawnEvent(now) {
    if (now < nextEventAt) return;
    scheduleNextEvent(now);

    const securityOwned = (gameState.staff.find(s => s.id === 'security-officer') || { owned: 0 }).owned;
    const weights = eventDefinitions.map(def =>
        def.polarity === 'bad' ? def.weight * Math.pow(SECURITY_EVENT_REDUCTION, securityOwned) : def.weight
    );
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    let chosen = eventDefinitions[eventDefinitions.length - 1];
    for (let i = 0; i < eventDefinitions.length; i++) {
        roll -= weights[i];
        if (roll <= 0) { chosen = eventDefinitions[i]; break; }
    }

    if (chosen.type === 'timed') {
        // Replace an existing instance of the same event rather than stacking.
        gameState.activeEvents = gameState.activeEvents.filter(e => e.id !== chosen.id);
        gameState.activeEvents.push({ id: chosen.id, endsAt: now + chosen.duration * 1000 });
        addNotification(`${chosen.name}: ${chosen.description}`, chosen.polarity === 'bad' ? 'warning' : 'info');
        renderEventBanner();
        return;
    }

    // Instant events.
    const rates = computeRates(gameState, getEventModifiers(gameState.activeEvents, eventDefinitions, now));
    if (chosen.instantMoneySeconds) {
        const amount = Math.max(chosen.minInstantMoney || 0, rates.moneyPerSecond * chosen.instantMoneySeconds);
        gameState.money += amount;
        gameState.totalMoneyEarned += amount;
        addNotification(`${chosen.name}: +$${Math.floor(amount).toLocaleString()} — ${chosen.description}`, 'success');
    } else if (chosen.instantReputation) {
        gameState.reputation += chosen.instantReputation;
        // Reputation from events bypasses the passenger-derived value, so
        // keep a bonus pool: simplest is to also credit passengers.
        gameState.totalPassengers += chosen.instantReputation * 10;
        gameState.passengers += chosen.instantReputation * 10;
        addNotification(`${chosen.name}: +${chosen.instantReputation} reputation — ${chosen.description}`, 'success');
    } else if (chosen.instantPassengersSeconds || chosen.instantPassengers) {
        const amount = Math.max(
            chosen.minInstantPassengers || 0,
            Math.ceil(chosen.instantPassengers ? chosen.instantPassengers
                : rates.passengersPerSecond * chosen.instantPassengersSeconds)
        );
        gameState.passengers += amount;
        gameState.totalPassengers += amount;
        addNotification(`${chosen.name}: +${amount.toLocaleString()} passengers — ${chosen.description}`, 'success');
    }
}

// ---------- Achievements ----------

export function checkAchievements() {
    let earned = false;
    for (const achievement of achievementDefinitions) {
        if (gameState.achievements.includes(achievement.id)) continue;
        if (isAchievementEarned(achievement, gameState)) {
            gameState.achievements.push(achievement.id);
            addNotification(`Achievement earned: ${achievement.name} — ${achievement.description}`, 'success');
            earned = true;
        }
    }
    if (earned) renderAchievements();
}

// ---------- Reset ----------

export function resetProgress() {
    if (!confirm('Are you sure you want to reset all progress? This cannot be undone.')) return;
    try {
        localStorage.removeItem('airportClickerSave');
    } catch (e) {
        console.error('Failed to clear save:', e);
    }
    resetState();
    ticksSinceSave = 0;
    lastTickTime = Date.now();
    scheduleNextEvent(Date.now() + 30000);
    refreshAll();
    addNotification('Game progress reset.', 'warning');
}
