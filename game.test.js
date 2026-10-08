// game.test.js — tests the REAL game modules (economy/state/gameLogic)
// under plain Node. The UI module is imported transitively; its DOM
// calls are satisfied with minimal stubs since every function
// early-returns when an element is missing.

// ---------- Environment stubs (must exist before module calls) ----------

const store = {};
global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
};
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add() {}, toggle() {} }, appendChild() {}, remove() {}, addEventListener() {} }),
    addEventListener: () => {},
};
global.window = { addEventListener: () => {} };
global.confirm = () => true;

const { jest } = await import('@jest/globals');
const { gameState, resetState, saveGame, loadGame } = await import('./js/modules/state.js');
const economy = await import('./js/modules/economy.js');
const logic = await import('./js/modules/gameLogic.js');
const { buildingDefinitions, staffDefinitions, upgradeDefinitions, eventDefinitions, achievementDefinitions } =
    await import('./js/modules/definitions.js');

const {
    formatNumber,
    getItemCost,
    getBulkCost,
    getMaxAffordable,
    getBuildingCost,
    computeRates,
    computeClickValue,
    reputationForPassengers,
    levelForReputation,
    reputationProgress,
    getEventModifiers,
    isAchievementEarned,
    MAX_RUNWAYS,
    RUNWAY_AURA_PER_RUNWAY,
    LEVEL_THRESHOLDS,
} = economy;

function freshState() {
    resetState();
    gameState.clickCooldown = false;
    return gameState;
}

// ---------- formatNumber ----------

describe('formatNumber', () => {
    test('formats small numbers without suffixes', () => {
        expect(formatNumber(0)).toBe('0');
        expect(formatNumber(5)).toBe('5');
        expect(formatNumber(7.5)).toBe('7.5');
        expect(formatNumber(999)).toBe('999');
    });

    test('formats thousands and millions', () => {
        expect(formatNumber(1500)).toBe('1.50K');
        expect(formatNumber(999_999)).toBe('1000K');
        expect(formatNumber(2_500_000)).toBe('2.50M');
        expect(formatNumber(12_345_678)).toBe('12.3M');
    });

    test('handles negatives', () => {
        expect(formatNumber(-1500)).toBe('-1.50K');
    });
});

// ---------- Costs ----------

describe('cost helpers', () => {
    test('getItemCost scales geometrically and floors', () => {
        expect(getItemCost(10, 1.15, 0)).toBe(10);
        expect(getItemCost(10, 1.15, 1)).toBe(11);
        expect(getItemCost(8, 2.2, 1)).toBe(17);
    });

    test('getBulkCost sums per-item costs', () => {
        const expected = getItemCost(10, 1.15, 0) + getItemCost(10, 1.15, 1) + getItemCost(10, 1.15, 2);
        expect(getBulkCost(10, 1.15, 0, 3)).toBe(expected);
    });

    test('getMaxAffordable returns affordable count', () => {
        // Costs: 10, 11, 13 -> 34 total for 3. $33 affords 2.
        expect(getMaxAffordable(10, 1.15, 0, 33)).toBe(2);
        expect(getMaxAffordable(10, 1.15, 0, 34)).toBe(3);
        expect(getMaxAffordable(10, 1.15, 0, 5)).toBe(0);
        expect(getMaxAffordable(10, 1.15, 0, 1e9, 8)).toBe(8); // cap respected
    });
});

// ---------- Production ----------

describe('computeRates', () => {
    test('empty state produces nothing', () => {
        const rates = computeRates(freshState());
        expect(rates.moneyPerSecond).toBe(0);
        expect(rates.passengersPerSecond).toBe(0);
    });

    test('single building produces base rates', () => {
        const state = freshState();
        const terminal = state.buildings.find(b => b.id === 'terminal');
        terminal.owned = 2;
        const rates = computeRates(state);
        expect(rates.moneyPerSecond).toBeCloseTo(terminal.moneyPerSecond * 2);
        expect(rates.passengersPerSecond).toBeCloseTo(terminal.passengersPerSecond * 2);
    });

    test('runway aura boosts other buildings but not itself', () => {
        const state = freshState();
        const runway = state.buildings.find(b => b.id === 'runway');
        const terminal = state.buildings.find(b => b.id === 'terminal');
        runway.owned = 4;
        terminal.owned = 1;
        const rates = computeRates(state);
        const expectedAura = 1 + RUNWAY_AURA_PER_RUNWAY * 4;
        const expectedMoney = runway.moneyPerSecond * 4 + terminal.moneyPerSecond * expectedAura;
        expect(rates.moneyPerSecond).toBeCloseTo(expectedMoney);
    });

    test('staff and upgrade multipliers stack multiplicatively', () => {
        const state = freshState();
        const terminal = state.buildings.find(b => b.id === 'terminal');
        terminal.owned = 1;
        const mechanic = state.staff.find(s => s.id === 'mechanic');
        mechanic.owned = 2; // 1.05^2 building money
        const baggage = state.upgrades.find(u => u.id === 'automated-baggage');
        baggage.purchased = true; // 1.5 building money
        const rates = computeRates(state);
        const expected = terminal.moneyPerSecond * Math.pow(1.05, 2) * 1.5;
        expect(rates.moneyPerSecond).toBeCloseTo(expected);
    });

    test('event modifiers scale output', () => {
        const state = freshState();
        state.buildings.find(b => b.id === 'terminal').owned = 1;
        const base = computeRates(state);
        const boosted = computeRates(state, { money: 1.5, passengers: 0.5 });
        expect(boosted.moneyPerSecond).toBeCloseTo(base.moneyPerSecond * 1.5);
        expect(boosted.passengersPerSecond).toBeCloseTo(base.passengersPerSecond * 0.5);
    });
});

// ---------- Click value ----------

describe('computeClickValue', () => {
    test('base values', () => {
        const { money, passengers } = computeClickValue(freshState());
        expect(money).toBe(2);
        expect(passengers).toBe(1);
    });

    test('pilots multiply click money, attendants multiply click passengers', () => {
        const state = freshState();
        state.staff.find(s => s.id === 'pilot').owned = 5;
        state.staff.find(s => s.id === 'flight-attendant').owned = 5;
        const { money, passengers } = computeClickValue(state);
        expect(money).toBeCloseTo(2 * Math.pow(1.04, 5));
        expect(passengers).toBeCloseTo(1 * Math.pow(1.08, 5));
    });

    test('purchased upgrades apply to clicks', () => {
        const state = freshState();
        state.upgrades.find(u => u.id === 'faster-check-in').purchased = true;
        expect(computeClickValue(state).money).toBeCloseTo(4);
        state.upgrades.find(u => u.id === 'better-seats').purchased = true;
        expect(computeClickValue(state).passengers).toBeCloseTo(2);
    });
});

// ---------- Reputation & levels ----------

describe('levels', () => {
    test('reputation derives from lifetime passengers', () => {
        expect(reputationForPassengers(0)).toBe(0);
        expect(reputationForPassengers(149)).toBe(14);
        expect(reputationForPassengers(150)).toBe(15);
    });

    test('levelForReputation follows thresholds', () => {
        expect(levelForReputation(0)).toBe(1);
        expect(levelForReputation(LEVEL_THRESHOLDS[2])).toBe(2);
        expect(levelForReputation(LEVEL_THRESHOLDS[2] - 1)).toBe(1);
        expect(levelForReputation(LEVEL_THRESHOLDS[12])).toBe(12);
        expect(levelForReputation(999_999_999)).toBe(12);
    });

    test('reputationProgress reports progress within a level', () => {
        const p = reputationProgress(20); // level 2 needs 15, level 3 needs 50
        expect(p.level).toBe(2);
        expect(p.current).toBe(5);
        expect(p.needed).toBe(35);
        expect(p.maxed).toBe(false);
    });
});

// ---------- Events ----------

describe('events', () => {
    test('getEventModifiers multiplies active timed events', () => {
        const now = Date.now();
        const active = [
            { id: 'clear-skies', endsAt: now + 60_000 },
            { id: 'weather-delay', endsAt: now + 45_000 },
            { id: 'expired', endsAt: now - 1 },
        ];
        const mods = getEventModifiers(active, eventDefinitions, now);
        expect(mods.money).toBeCloseTo(1.5 * 0.6);
        expect(mods.passengers).toBeCloseTo(1.5 * 0.6);
    });

    test('every event definition is well-formed', () => {
        for (const def of eventDefinitions) {
            expect(['instant', 'timed']).toContain(def.type);
            if (def.type === 'timed') expect(def.duration).toBeGreaterThan(0);
        }
    });
});

// ---------- Definitions integrity ----------

describe('definitions', () => {
    const VALID_TARGETS = new Set([
        'clickMoney', 'clickPassengers', 'buildingMoney', 'buildingPassengers',
        'allMoney', 'allPassengers', 'all',
    ]);

    test('all ids are unique within each list', () => {
        for (const list of [buildingDefinitions, staffDefinitions, upgradeDefinitions]) {
            const ids = list.map(i => i.id);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });

    test('all costs are positive and unlock levels are valid', () => {
        const buildingIds = new Set(buildingDefinitions.map(b => b.id));
        for (const b of buildingDefinitions) {
            expect(b.baseCost).toBeGreaterThan(0);
            expect(b.unlockLevel).toBeGreaterThanOrEqual(1);
            expect(b.unlockLevel).toBeLessThanOrEqual(LEVEL_THRESHOLDS.length - 1);
        }
        for (const s of staffDefinitions) {
            expect(s.baseCost).toBeGreaterThan(0);
            expect(s.effect && s.effect.factor).toBeGreaterThan(0);
            const ok = VALID_TARGETS.has(s.effect.target) ||
                (s.effect.target.startsWith('building:') && buildingIds.has(s.effect.target.slice(9)));
            expect(ok).toBe(true);
        }
        for (const u of upgradeDefinitions) {
            expect(u.cost).toBeGreaterThan(0);
            const ok = VALID_TARGETS.has(u.effect.target) ||
                (u.effect.target.startsWith('building:') && buildingIds.has(u.effect.target.slice(9)));
            expect(ok).toBe(true);
        }
    });
});

// ---------- Achievements ----------

describe('achievements', () => {
    test('threshold conditions evaluate against state', () => {
        const state = freshState();
        const firstFlight = achievementDefinitions.find(a => a.id === 'first-flight');
        expect(isAchievementEarned(firstFlight, state)).toBe(false);
        state.totalFlights = 1;
        expect(isAchievementEarned(firstFlight, state)).toBe(true);
    });

    test('every achievement condition references a known stat', () => {
        const state = freshState();
        for (const a of achievementDefinitions) {
            expect(() => isAchievementEarned(a, state)).not.toThrow();
        }
    });
});

// ---------- Purchases (real gameLogic) ----------

describe('buyBuilding', () => {
    beforeEach(() => { freshState(); });

    test('buys a building when affordable', () => {
        gameState.money = 100;
        const runway = gameState.buildings.find(b => b.id === 'runway');
        expect(logic.buyBuilding('runway')).toBe(true);
        expect(runway.owned).toBe(1);
        expect(gameState.money).toBe(100 - getBuildingCost({ ...runway, owned: 0 }));
    });

    test('refuses when broke', () => {
        gameState.money = 1;
        expect(logic.buyBuilding('runway')).toBe(false);
        expect(gameState.buildings.find(b => b.id === 'runway').owned).toBe(0);
    });

    test('refuses locked buildings', () => {
        gameState.money = 1e9;
        expect(logic.buyBuilding('spaceport')).toBe(false);
        expect(gameState.buildings.find(b => b.id === 'spaceport').owned).toBe(0);
    });

    test('runway cap enforced', () => {
        gameState.money = 1e12;
        const runway = gameState.buildings.find(b => b.id === 'runway');
        runway.owned = MAX_RUNWAYS;
        expect(logic.buyBuilding('runway')).toBe(false);
        expect(runway.owned).toBe(MAX_RUNWAYS);
    });

    test('bulk quantity buys multiple', () => {
        gameState.money = 1e6;
        gameState.buyQuantity = 10;
        const terminal = gameState.buildings.find(b => b.id === 'terminal');
        expect(logic.buyBuilding('terminal')).toBe(true);
        expect(terminal.owned).toBe(10);
    });
});

describe('hireStaff', () => {
    beforeEach(() => { freshState(); });

    test('hires staff when affordable and unlocked', () => {
        gameState.money = 100;
        expect(logic.hireStaff('pilot')).toBe(true);
        expect(gameState.staff.find(s => s.id === 'pilot').owned).toBe(1);
    });

    test('refuses locked staff', () => {
        gameState.money = 1e9;
        expect(logic.hireStaff('mechanic')).toBe(false); // mechanic unlocks at level 2
    });
});

describe('purchaseUpgrade', () => {
    beforeEach(() => { freshState(); });

    test('purchase applies its effect', () => {
        gameState.money = 1000;
        expect(logic.purchaseUpgrade('faster-check-in')).toBe(true);
        expect(computeClickValue(gameState).money).toBeCloseTo(4);
        expect(gameState.money).toBe(1000 - 300);
    });

    test('cannot buy twice', () => {
        gameState.money = 1000;
        logic.purchaseUpgrade('better-seats');
        expect(logic.purchaseUpgrade('better-seats')).toBe(false);
    });

    test('refuses locked upgrades', () => {
        gameState.money = 1e9;
        expect(logic.purchaseUpgrade('galactic-scheduling')).toBe(false);
    });
});

// ---------- Clicks ----------

describe('handleMainClick', () => {
    beforeEach(() => { freshState(); });

    test('grants money and passengers', () => {
        logic.handleMainClick();
        expect(gameState.money).toBeCloseTo(2);
        expect(gameState.passengers).toBe(1);
        expect(gameState.totalFlights).toBe(1);
        expect(gameState.totalMoneyEarned).toBeCloseTo(2);
    });

    test('click cooldown blocks double-clicks', () => {
        logic.handleMainClick();
        logic.handleMainClick(); // within cooldown window
        expect(gameState.totalFlights).toBe(1);
    });
});

// ---------- Level unlocks ----------

describe('checkLevelUp', () => {
    test('unlocks level-gated content when reputation crosses threshold', () => {
        freshState();
        gameState.totalPassengers = LEVEL_THRESHOLDS[2] * 10; // rep == threshold for L2
        logic.checkLevelUp();
        expect(gameState.airportLevel).toBe(2);
        expect(gameState.buildings.find(b => b.id === 'control-tower').unlocked).toBe(true);
        expect(gameState.staff.find(s => s.id === 'mechanic').unlocked).toBe(true);
        expect(gameState.buildings.find(b => b.id === 'spaceport').unlocked).toBe(false);
    });
});

// ---------- Save / load ----------

describe('persistence', () => {
    test('save + load round-trips owned counts and purchases', () => {
        freshState();
        gameState.money = 12345;
        gameState.buildings.find(b => b.id === 'terminal').owned = 7;
        gameState.staff.find(s => s.id === 'pilot').owned = 3;
        gameState.upgrades.find(u => u.id === 'better-seats').purchased = true;
        gameState.achievements.push('first-flight');
        gameState.buyQuantity = 10;
        saveGame();

        freshState();
        expect(gameState.money).toBe(0);

        const result = loadGame();
        expect(result.loaded).toBe(true);
        expect(gameState.money).toBe(12345);
        expect(gameState.buildings.find(b => b.id === 'terminal').owned).toBe(7);
        expect(gameState.staff.find(s => s.id === 'pilot').owned).toBe(3);
        expect(gameState.upgrades.find(u => u.id === 'better-seats').purchased).toBe(true);
        expect(gameState.achievements).toContain('first-flight');
        expect(gameState.buyQuantity).toBe(10);
    });

    test('migrates a v1 save (no version field, old shape)', () => {
        freshState();
        store['airportClickerSave'] = JSON.stringify({
            money: 500,
            passengers: 42,
            reputation: 12,
            totalFlights: 900,
            totalPassengers: 420,
            airportLevel: 2,
            clickValue: 1,
            passengersPerClick: 1,
            buildings: [{ id: 'runway', owned: 3, unlocked: true }, { id: 'terminal', owned: 2, unlocked: true }],
            staff: [{ id: 'pilot', owned: 5, unlocked: true }],
            upgrades: [{ id: 'better-seats', purchased: true, unlocked: true }],
        });

        const result = loadGame();
        expect(result.loaded).toBe(true);
        expect(result.migrated).toBe(true);
        expect(gameState.money).toBe(500);
        expect(gameState.buildings.find(b => b.id === 'runway').owned).toBe(3);
        expect(gameState.staff.find(s => s.id === 'pilot').owned).toBe(5);
        // Upgrade still works after migration — data-driven effects.
        expect(computeClickValue(gameState).passengers).toBeCloseTo(2);
        // Level is recomputed from reputation/passengers, not trusted.
        expect(gameState.airportLevel).toBe(levelForReputation(gameState.reputation));
        // Unlock flags follow the FINAL level: 420 passengers -> rep 42
        // -> level 2, so level-2 content is unlocked even though the
        // saved reputation only implied level 1.
        expect(gameState.airportLevel).toBe(2);
        const level2Def = buildingDefinitions.find(d => d.unlockLevel === 2);
        expect(gameState.buildings.find(b => b.id === level2Def.id).unlocked).toBe(true);
        const level3Def = buildingDefinitions.find(d => d.unlockLevel === 3);
        expect(gameState.buildings.find(b => b.id === level3Def.id).unlocked).toBe(false);
    });

    test('returns not-loaded for empty storage and survives corrupt saves', () => {
        freshState();
        delete store['airportClickerSave'];
        expect(loadGame().loaded).toBe(false);

        store['airportClickerSave'] = '{not json';
        expect(loadGame().loaded).toBe(false);

        // Syntactically valid but unusable: `null` used to crash on
        // `parsed.version` and abort startup on every reload.
        store['airportClickerSave'] = 'null';
        expect(loadGame().loaded).toBe(false);
        expect(store['airportClickerSave']).toBeUndefined();

        // Malformed collection entries: the merge must not throw.
        store['airportClickerSave'] = JSON.stringify({ version: 2, buildings: [null] });
        expect(loadGame().loaded).toBe(false);
        expect(store['airportClickerSave']).toBeUndefined();
    });
});

describe('timed event crediting', () => {
    test('a tick spanning an event boundary credits each segment at its own rate', () => {
        jest.useFakeTimers();
        try {
            freshState();
            gameState.buildings.find(b => b.id === 'terminal').owned = 1;

            const t0 = Date.now();
            jest.setSystemTime(t0);
            logic.gameLoop(); // anchors lastTickTime to t0 (may spawn one event)
            const moneyAfterSync = gameState.money;

            // +50% Clear Skies that ends halfway through the next tick.
            gameState.activeEvents = [{ id: 'clear-skies', endsAt: t0 + 15000 }];

            jest.setSystemTime(t0 + 30000); // still before the next spawn (>=45s)
            logic.gameLoop();

            const base = computeRates(gameState, { moneyMult: 1, passengersMult: 1 }).moneyPerSecond;
            const expected = base * (15 * 1.5 + 15 * 1.0);
            expect(gameState.money - moneyAfterSync).toBeCloseTo(expected, 5);
        } finally {
            jest.useRealTimers();
        }
    });
});
