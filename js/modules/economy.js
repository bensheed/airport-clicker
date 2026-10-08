// economy.js — pure game-math module. No DOM, no gameState imports:
// every function takes explicit inputs so it can be unit-tested in Node.

// ---------- Tunable constants ----------

export const BUILDING_COST_SCALING = 1.15;
export const STAFF_COST_SCALING = 1.18;
export const RUNWAY_COST_SCALING = 2.2;

export const MAX_RUNWAYS = 8;
// Each runway boosts every *other* building's output by this much (additive per runway).
export const RUNWAY_AURA_PER_RUNWAY = 0.10;

export const BASE_CLICK_MONEY = 2;
export const BASE_CLICK_PASSENGERS = 1;

// Reputation is derived from lifetime passengers.
export const PASSENGERS_PER_REPUTATION = 10;

// Reputation required to *reach* each level (index = level). Index 0 unused.
export const LEVEL_THRESHOLDS = [
    0,      // level 0 (unused)
    0,      // level 1 — starting level
    15,     // level 2  (150 passengers)
    50,     // level 3
    150,    // level 4
    400,    // level 5
    1000,   // level 6
    2500,   // level 7
    6000,   // level 8
    15000,  // level 9
    35000,  // level 10
    90000,  // level 11
    250000, // level 12
];

export const MAX_LEVEL = LEVEL_THRESHOLDS.length - 1;

// ---------- Number formatting ----------

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];

export function formatNumber(n) {
    if (!Number.isFinite(n)) return '0';
    if (n < 0) return '-' + formatNumber(-n);
    if (n < 1000) {
        // Whole numbers stay whole; fractions get one decimal.
        return n % 1 === 0 ? String(n) : n.toFixed(1);
    }
    let tier = Math.floor(Math.log10(n) / 3);
    if (tier >= SUFFIXES.length) tier = SUFFIXES.length - 1;
    const scaled = n / Math.pow(10, tier * 3);
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return scaled.toFixed(digits) + SUFFIXES[tier];
}

// ---------- Costs ----------

// Cost of the (owned + 1)-th copy of an item.
export function getItemCost(baseCost, costScaling, owned) {
    return Math.floor(baseCost * Math.pow(costScaling, owned));
}

// Total cost of buying `qty` copies starting at `owned`.
export function getBulkCost(baseCost, costScaling, owned, qty) {
    let total = 0;
    for (let i = 0; i < qty; i++) {
        total += getItemCost(baseCost, costScaling, owned + i);
    }
    return total;
}

// How many copies `money` can buy starting at `owned` (0 if none).
export function getMaxAffordable(baseCost, costScaling, owned, money, cap = Infinity) {
    let qty = 0;
    let spent = 0;
    while (qty < cap) {
        const next = getItemCost(baseCost, costScaling, owned + qty);
        if (spent + next > money) break;
        spent += next;
        qty++;
    }
    return qty;
}

export function getBuildingScaling(building) {
    return building.id === 'runway'
        ? (building.costScalingFactor || RUNWAY_COST_SCALING)
        : BUILDING_COST_SCALING;
}

export function getBuildingCost(building) {
    return getItemCost(building.baseCost, getBuildingScaling(building), building.owned);
}

export function getStaffCost(staff) {
    return getItemCost(staff.baseCost, STAFF_COST_SCALING, staff.owned);
}

// ---------- Multiplier aggregation ----------

// Effect targets understood by computeMultipliers:
//   'clickMoney'          multiplies money per click
//   'clickPassengers'     multiplies passengers per click
//   'buildingMoney'       multiplies $/s of every building
//   'buildingPassengers'  multiplies pax/s of every building
//   'allMoney'            clickMoney + buildingMoney
//   'allPassengers'       clickPassengers + buildingPassengers
//   'all'                 everything
//   'building:<id>'       both outputs of one building
function applyTarget(multipliers, target, factor) {
    switch (target) {
        case 'clickMoney': multipliers.clickMoney *= factor; break;
        case 'clickPassengers': multipliers.clickPassengers *= factor; break;
        case 'buildingMoney': multipliers.buildingMoney *= factor; break;
        case 'buildingPassengers': multipliers.buildingPassengers *= factor; break;
        case 'allMoney':
            multipliers.clickMoney *= factor;
            multipliers.buildingMoney *= factor;
            break;
        case 'allPassengers':
            multipliers.clickPassengers *= factor;
            multipliers.buildingPassengers *= factor;
            break;
        case 'all':
            multipliers.clickMoney *= factor;
            multipliers.clickPassengers *= factor;
            multipliers.buildingMoney *= factor;
            multipliers.buildingPassengers *= factor;
            break;
        default:
            if (typeof target === 'string' && target.startsWith('building:')) {
                const id = target.slice('building:'.length);
                multipliers.perBuilding[id] = (multipliers.perBuilding[id] || 1) * factor;
            }
    }
}

// Combined multipliers from purchased upgrades and hired staff.
// `state` needs only { upgrades, staff }.
export function computeMultipliers(state) {
    const multipliers = {
        clickMoney: 1,
        clickPassengers: 1,
        buildingMoney: 1,
        buildingPassengers: 1,
        perBuilding: {},
    };

    for (const upgrade of state.upgrades || []) {
        if (upgrade.purchased && upgrade.effect) {
            applyTarget(multipliers, upgrade.effect.target, upgrade.effect.factor);
        }
    }

    for (const staff of state.staff || []) {
        if (staff.owned > 0 && staff.effect) {
            applyTarget(multipliers, staff.effect.target, Math.pow(staff.effect.factor, staff.owned));
        }
    }

    return multipliers;
}

// ---------- Production & clicks ----------

// Passive income rates.
// `state` needs { buildings, staff, upgrades }.
// `eventMods` = { money: x, passengers: y } from getEventModifiers (optional).
export function computeRates(state, eventMods = {}) {
    const multipliers = computeMultipliers(state);
    const runway = (state.buildings || []).find(b => b.id === 'runway');
    const runwayCount = runway ? Math.min(runway.owned, MAX_RUNWAYS) : 0;
    const aura = 1 + RUNWAY_AURA_PER_RUNWAY * runwayCount;

    let money = 0;
    let passengers = 0;

    for (const building of state.buildings || []) {
        if (!building.owned) continue;
        const perBuilding = multipliers.perBuilding[building.id] || 1;
        // Runways don't benefit from their own aura (it only boosts other buildings).
        const buildingAura = building.id === 'runway' ? 1 : aura;
        money += (building.moneyPerSecond || 0) * building.owned * multipliers.buildingMoney * perBuilding * buildingAura;
        passengers += (building.passengersPerSecond || 0) * building.owned * multipliers.buildingPassengers * perBuilding * buildingAura;
    }

    return {
        moneyPerSecond: money * (eventMods.money || 1),
        passengersPerSecond: passengers * (eventMods.passengers || 1),
    };
}

// What one click of "Operate Flight" yields right now.
// `state` needs { clickValue, passengersPerClick, staff, upgrades }.
// Missing base fields fall back to the BASE_* constants.
export function computeClickValue(state) {
    const multipliers = computeMultipliers(state);
    const baseMoney = typeof state.clickValue === 'number' ? state.clickValue : BASE_CLICK_MONEY;
    const basePax = typeof state.passengersPerClick === 'number' ? state.passengersPerClick : BASE_CLICK_PASSENGERS;
    return {
        money: baseMoney * multipliers.clickMoney,
        passengers: basePax * multipliers.clickPassengers,
    };
}

// ---------- Reputation & levels ----------

export function reputationForPassengers(totalPassengers) {
    return Math.floor(totalPassengers / PASSENGERS_PER_REPUTATION);
}

export function levelForReputation(reputation) {
    let level = 1;
    for (let i = 2; i < LEVEL_THRESHOLDS.length; i++) {
        if (reputation >= LEVEL_THRESHOLDS[i]) level = i;
    }
    return level;
}

// Progress within the current level toward the next one.
export function reputationProgress(reputation) {
    const level = levelForReputation(reputation);
    if (level >= MAX_LEVEL) {
        return { level, current: reputation - LEVEL_THRESHOLDS[level], needed: 0, fraction: 1, maxed: true };
    }
    const floor = LEVEL_THRESHOLDS[level];
    const needed = LEVEL_THRESHOLDS[level + 1] - floor;
    const current = reputation - floor;
    return { level, current, needed, fraction: current / needed, maxed: false };
}

// ---------- Events ----------

// Combine active event instances [{id, endsAt}] into production modifiers.
// `eventDefs` is the static eventDefinitions array; `now` is ms epoch.
export function getEventModifiers(activeEvents, eventDefs, now) {
    const mods = { money: 1, passengers: 1 };
    for (const active of activeEvents || []) {
        if (active.endsAt <= now) continue;
        const def = eventDefs.find(e => e.id === active.id);
        if (!def) continue;
        if (def.moneyMult) mods.money *= def.moneyMult;
        if (def.passengersMult) mods.passengers *= def.passengersMult;
    }
    return mods;
}

// ---------- Achievements ----------

// Stats that achievement conditions can reference.
export function getAchievementStats(state) {
    return {
        flights: state.totalFlights || 0,
        lifetimeMoney: state.totalMoneyEarned || 0,
        passengers: state.totalPassengers || 0,
        reputation: state.reputation || 0,
        level: state.airportLevel || 1,
        buildings: (state.buildings || []).reduce((sum, b) => sum + (b.owned || 0), 0),
        staff: (state.staff || []).reduce((sum, s) => sum + (s.owned || 0), 0),
        upgrades: (state.upgrades || []).filter(u => u.purchased).length,
        runways: ((state.buildings || []).find(b => b.id === 'runway') || { owned: 0 }).owned,
    };
}

// Achievement definition condition: { stat: '<key above>', threshold: n }
export function isAchievementEarned(achievement, state) {
    const stats = getAchievementStats(state);
    const value = stats[achievement.condition.stat] || 0;
    return value >= achievement.condition.threshold;
}
