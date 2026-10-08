// ui.js — all DOM access lives here. Handlers for shop actions are
// injected via initUI() so this module never imports gameLogic.js
// (acyclic module graph). Click handlers use event delegation, so
// re-rendering lists never orphans listeners.

import { gameState } from './state.js';
import {
    formatNumber,
    getBulkCost,
    getMaxAffordable,
    getBuildingScaling,
    computeClickValue,
    computeMultipliers,
    reputationProgress,
    LEVEL_THRESHOLDS,
    MAX_RUNWAYS,
    RUNWAY_AURA_PER_RUNWAY,
    STAFF_COST_SCALING,
} from './economy.js';
import {
    buildingDefinitions,
    staffDefinitions,
    upgradeDefinitions,
    achievementDefinitions,
    eventDefinitions,
} from './definitions.js';

// ---------- Setup ----------

// handlers: { onBuyBuilding, onHireStaff, onPurchaseUpgrade, onSetQuantity, onReset }
export function initUI(handlers) {
    const clicker = document.getElementById('main-clicker');
    if (clicker && handlers.onMainClick) {
        clicker.addEventListener('click', handlers.onMainClick);
    }

    // Delegated buy/hire/purchase clicks — survives re-renders.
    const tabContent = document.querySelector('.tab-content');
    if (tabContent) {
        tabContent.addEventListener('click', event => {
            const button = event.target.closest('button');
            if (!button || button.disabled) return;
            if (button.dataset.building) handlers.onBuyBuilding(button.dataset.building);
            else if (button.dataset.staff) handlers.onHireStaff(button.dataset.staff);
            else if (button.dataset.upgrade) handlers.onPurchaseUpgrade(button.dataset.upgrade);
        });
    }

    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        });
    });

    document.querySelectorAll('.qty-button').forEach(button => {
        button.addEventListener('click', () => {
            const qty = button.dataset.qty === 'max' ? 'max' : parseInt(button.dataset.qty, 10);
            if (qty && handlers.onSetQuantity) handlers.onSetQuantity(qty);
        });
    });

    const resetButton = document.getElementById('reset-progress-button');
    if (resetButton && handlers.onReset) {
        resetButton.addEventListener('click', handlers.onReset);
    }
}

// ---------- Resource header ----------

export function updateResourceDisplay() {
    setText('money', formatNumber(gameState.money));
    setText('passengers', formatNumber(gameState.passengers));
    setText('reputation', formatNumber(gameState.reputation));
    setText('header-level', gameState.airportLevel);

    const moneyRate = gameState.moneyPerSecond || 0;
    const paxRate = gameState.passengersPerSecond || 0;
    setText('money-rate', `+$${formatNumber(moneyRate)}/s`);
    setText('passengers-rate', `+${formatNumber(paxRate)}/s`);

    const click = computeClickValue(gameState);
    setText('click-value', `+$${formatNumber(click.money)} · +${formatNumber(click.passengers)} pax per flight`);

    const progress = reputationProgress(gameState.reputation);
    const bar = document.getElementById('level-progress-bar');
    const text = document.getElementById('level-progress-text');
    if (bar) {
        bar.value = progress.maxed ? 1 : progress.current;
        bar.max = progress.maxed ? 1 : progress.needed;
    }
    if (text) {
        text.textContent = progress.maxed
            ? 'Max level'
            : `${formatNumber(progress.current)}/${formatNumber(progress.needed)} Rep to Lv${progress.level + 1}`;
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ---------- Level unlocks (Stats tab) ----------

export function renderLevelUnlocks() {
    const unlockListEl = document.getElementById('level-unlocks-list');
    if (!unlockListEl) return;

    // Group every unlockable definition by the level that unlocks it.
    const byLevel = new Map();
    for (const item of [...buildingDefinitions, ...staffDefinitions, ...upgradeDefinitions]) {
        const level = item.unlockLevel || 1;
        if (level <= 1) continue;
        if (!byLevel.has(level)) byLevel.set(level, []);
        byLevel.get(level).push(item.name);
    }

    let html = '<h3>Level Unlocks</h3><ul>';
    for (const [level, names] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
        const done = gameState.airportLevel >= level ? ' class="unlock-done"' : '';
        html += `<li${done}><strong>Level ${level}</strong> (${LEVEL_THRESHOLDS[level]} rep): ${names.join(', ')}</li>`;
    }
    html += '</ul>';
    unlockListEl.innerHTML = html;
}

// ---------- Quantity selector ----------

export function updateQuantitySelector() {
    document.querySelectorAll('.qty-button').forEach(button => {
        const qty = button.dataset.qty === 'max' ? 'max' : parseInt(button.dataset.qty, 10);
        button.classList.toggle('active', qty === gameState.buyQuantity);
    });
}

function quantityLabel(item, scaling) {
    const selected = gameState.buyQuantity;
    if (selected === 'max') {
        const cap = item.id === 'runway' ? MAX_RUNWAYS - item.owned : Infinity;
        const qty = Math.min(getMaxAffordable(item.baseCost, scaling, item.owned, gameState.money), cap);
        return Math.max(qty, 1);
    }
    return Math.min(selected, item.id === 'runway' ? MAX_RUNWAYS - item.owned : selected);
}

// ---------- Shop rendering ----------

export function renderBuildings() {
    const list = document.querySelector('.building-list');
    if (!list) return;
    list.innerHTML = '';

    const multipliers = currentMultipliers();

    for (const building of gameState.buildings) {
        const scaling = getBuildingScaling(building);
        const isLocked = !building.unlocked;
        const atCap = building.id === 'runway' && building.owned >= MAX_RUNWAYS;
        const qty = quantityLabel(building, scaling);
        const cost = getBulkCost(building.baseCost, scaling, building.owned, qty);
        const canAfford = gameState.money >= cost && !atCap;

        const perBuildingMult = multipliers.perBuilding[building.id] || 1;
        const runwayAura = building.id === 'runway' ? 1 : 1 + RUNWAY_AURA_PER_RUNWAY * runwayCount();
        const moneyEach = (building.moneyPerSecond || 0) * multipliers.buildingMoney * perBuildingMult * runwayAura;
        const paxEach = (building.passengersPerSecond || 0) * multipliers.buildingPassengers * perBuildingMult * runwayAura;

        let productionText = `Each: $${formatNumber(moneyEach)}/s · ${formatNumber(paxEach)} pax/s`;
        if (building.owned > 0) {
            productionText += `<br>Owned ×${building.owned}: $${formatNumber(moneyEach * building.owned)}/s · ${formatNumber(paxEach * building.owned)} pax/s`;
        }
        if (building.id === 'runway' && building.owned > 0) {
            productionText += `<br>Aura: +${Math.round(RUNWAY_AURA_PER_RUNWAY * building.owned * 100)}% to all other buildings`;
        }

        const buttonLabel = isLocked
            ? `Unlocks at level ${building.unlockLevel}`
            : atCap
                ? 'Max Reached'
                : `Buy ×${qty} — $${formatNumber(cost)}`;

        const el = document.createElement('div');
        el.className = `shop-item ${isLocked ? 'locked' : ''}`;
        el.innerHTML = `
            <div class="item-name">${building.name} <span class="owned-count">(${building.owned}${building.id === 'runway' ? '/' + MAX_RUNWAYS : ''})</span></div>
            <div class="item-description">${building.description}</div>
            <div class="item-production">${productionText}</div>
            <button class="buy-button" data-building="${building.id}" ${isLocked || !canAfford ? 'disabled' : ''}>${buttonLabel}</button>
        `;
        list.appendChild(el);
    }
}

export function renderStaff() {
    const list = document.querySelector('.staff-list');
    if (!list) return;
    list.innerHTML = '';

    for (const staff of gameState.staff) {
        const isLocked = !staff.unlocked;
        const qty = quantityLabel(staff, STAFF_COST_SCALING);
        const cost = getBulkCost(staff.baseCost, STAFF_COST_SCALING, staff.owned, qty);
        const canAfford = gameState.money >= cost;

        const bonusText = staff.effect ? describeEffect(staff.effect, true) : '';

        const buttonLabel = isLocked
            ? `Unlocks at level ${staff.unlockLevel}`
            : `Hire ×${qty} — $${formatNumber(cost)}`;

        const el = document.createElement('div');
        el.className = `shop-item ${isLocked ? 'locked' : ''}`;
        el.innerHTML = `
            <div class="item-name">${staff.name} <span class="owned-count">(${staff.owned})</span></div>
            <div class="item-description">${staff.description}</div>
            <div class="item-production">${bonusText}</div>
            <button class="buy-button" data-staff="${staff.id}" ${isLocked || !canAfford ? 'disabled' : ''}>${buttonLabel}</button>
        `;
        list.appendChild(el);
    }
}

export function renderUpgrades() {
    const list = document.querySelector('.upgrade-list');
    if (!list) return;
    list.innerHTML = '';

    for (const upgrade of gameState.upgrades) {
        const isLocked = !upgrade.unlocked;
        const isPurchased = upgrade.purchased;
        const canAfford = gameState.money >= upgrade.cost;

        const buttonLabel = isLocked
            ? `Unlocks at level ${upgrade.unlockLevel}`
            : isPurchased
                ? 'Purchased'
                : `Purchase — $${formatNumber(upgrade.cost)}`;

        const el = document.createElement('div');
        el.className = `shop-item upgrade-item ${isPurchased ? 'purchased' : ''} ${isLocked ? 'locked' : ''}`;
        el.innerHTML = `
            <div class="item-name">${upgrade.name}</div>
            <div class="item-description">${upgrade.description}</div>
            <div class="item-production">${upgrade.effectText}</div>
            <button class="buy-button" data-upgrade="${upgrade.id}" ${isLocked || isPurchased || !canAfford ? 'disabled' : ''}>${buttonLabel}</button>
        `;
        list.appendChild(el);
    }
}

export function renderAchievements() {
    const list = document.querySelector('.achievement-list');
    if (!list) return;
    list.innerHTML = '';

    for (const achievement of achievementDefinitions) {
        const earned = gameState.achievements.includes(achievement.id);
        const el = document.createElement('div');
        el.className = `shop-item achievement-item ${earned ? 'earned' : 'unearned'}`;
        el.innerHTML = `
            <div class="item-name">${achievement.name}${earned ? ' <span class="earned-tag">Earned</span>' : ''}</div>
            <div class="item-description">${achievement.description}</div>
        `;
        list.appendChild(el);
    }
}

export function renderStats() {
    setText('total-flights', formatNumber(gameState.totalFlights));
    setText('total-passengers', formatNumber(gameState.totalPassengers));
    setText('airport-level', gameState.airportLevel);
    setText('stat-money-rate', `$${formatNumber(gameState.moneyPerSecond)}/s`);
    setText('stat-pax-rate', `${formatNumber(gameState.passengersPerSecond)}/s`);
    setText('stat-lifetime-money', `$${formatNumber(gameState.totalMoneyEarned)}`);
    const click = computeClickValue(gameState);
    setText('stat-click-value', `$${formatNumber(click.money)} · ${formatNumber(click.passengers)} pax`);
    setText('stat-achievements', `${gameState.achievements.length}/${achievementDefinitions.length}`);
}

export function renderEventBanner() {
    const banner = document.getElementById('event-banner');
    if (!banner) return;
    const now = Date.now();
    const active = gameState.activeEvents.filter(e => e.endsAt > now);
    if (active.length === 0) {
        banner.innerHTML = '';
        banner.className = 'event-banner hidden';
        return;
    }
    banner.className = 'event-banner';
    banner.innerHTML = active.map(active => {
        const def = eventDefinitions.find(d => d.id === active.id);
        const secs = Math.max(0, Math.ceil((active.endsAt - now) / 1000));
        return `<span class="event-chip ${def && def.polarity === 'bad' ? 'bad' : 'good'}">${def ? def.name : active.id} · ${secs}s</span>`;
    }).join('');
}

// ---------- Helpers ----------

function runwayCount() {
    const runway = gameState.buildings.find(b => b.id === 'runway');
    return runway ? Math.min(runway.owned, MAX_RUNWAYS) : 0;
}

function currentMultipliers() {
    return computeMultipliers(gameState);
}

// Human-readable description of a staff effect.
function describeEffect(effect, perUnit) {
    const pct = Math.round((effect.factor - 1) * 100);
    const sign = pct >= 0 ? '+' : '';
    const per = perUnit ? ' each' : '';
    const labels = {
        clickMoney: 'money per flight',
        clickPassengers: 'passengers per flight',
        buildingMoney: 'building income',
        buildingPassengers: 'passenger production',
        allMoney: 'all money income',
        allPassengers: 'all passenger gains',
        all: 'all gains',
    };
    const label = labels[effect.target] || effect.target;
    return `${sign}${pct}% ${label}${per}`;
}

// ---------- Button states & badges ----------

export function updateButtonStates() {
    const money = gameState.money;
    document.querySelectorAll('.buy-button').forEach(button => {
        const buildingId = button.dataset.building;
        const staffId = button.dataset.staff;
        const upgradeId = button.dataset.upgrade;

        let disabled = true;
        if (buildingId) {
            const item = gameState.buildings.find(b => b.id === buildingId);
            if (item && item.unlocked) {
                const atCap = item.id === 'runway' && item.owned >= MAX_RUNWAYS;
                if (!atCap) {
                    const qty = quantityLabel(item, getBuildingScaling(item));
                    disabled = money < getBulkCost(item.baseCost, getBuildingScaling(item), item.owned, qty);
                }
            }
        } else if (staffId) {
            const item = gameState.staff.find(s => s.id === staffId);
            if (item && item.unlocked) {
                const qty = quantityLabel(item, STAFF_COST_SCALING);
                disabled = money < getBulkCost(item.baseCost, STAFF_COST_SCALING, item.owned, qty);
            }
        } else if (upgradeId) {
            const item = gameState.upgrades.find(u => u.id === upgradeId);
            if (item) disabled = !item.unlocked || item.purchased || money < item.cost;
        }
        button.disabled = disabled;
    });
}

export function updateTabBadges() {
    const money = gameState.money;
    const activeTab = document.querySelector('.tab-pane.active');
    const activeTabId = activeTab ? activeTab.id : '';

    const affordableBuilding = gameState.buildings.some(b => {
        if (!b.unlocked) return false;
        if (b.id === 'runway' && b.owned >= MAX_RUNWAYS) return false;
        return money >= getBulkCost(b.baseCost, getBuildingScaling(b), b.owned, quantityLabel(b, getBuildingScaling(b)));
    });
    setBadge('buildings', affordableBuilding && activeTabId !== 'buildings');

    const affordableStaff = gameState.staff.some(s => {
        if (!s.unlocked) return false;
        return money >= getBulkCost(s.baseCost, STAFF_COST_SCALING, s.owned, quantityLabel(s, STAFF_COST_SCALING));
    });
    setBadge('staff', affordableStaff && activeTabId !== 'staff');

    const affordableUpgrade = gameState.upgrades.some(u =>
        u.unlocked && !u.purchased && money >= u.cost
    );
    setBadge('upgrades', affordableUpgrade && activeTabId !== 'upgrades');
}

function setBadge(tabId, visible) {
    const badge = document.querySelector(`.tab-button[data-tab="${tabId}"] .badge`);
    if (badge) badge.classList.toggle('visible', visible);
}

export function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));

    const pane = document.getElementById(tabId);
    if (pane) pane.classList.add('active');
    const button = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (button) button.classList.add('active');

    if (tabId === 'stats') renderStats();
    if (tabId === 'achievements') renderAchievements();
    updateTabBadges();
}

// ---------- Notifications & feedback ----------

export function addNotification(message, type = 'info') {
    const list = document.getElementById('notification-list');
    if (!list) return;
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.textContent = message;
    list.prepend(el);
    while (list.children.length > 12) {
        list.lastElementChild.remove();
    }
}

export function showClickFeedback(money, passengers) {
    const container = document.getElementById('click-feedback');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'click-feedback-item';
    el.textContent = `+$${formatNumber(money)} · +${formatNumber(passengers)} pax`;
    // Slight horizontal jitter so rapid clicks don't perfectly overlap.
    el.style.left = `${45 + Math.random() * 10}%`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// Full re-render — used on init and reset.
export function refreshAll() {
    updateResourceDisplay();
    renderBuildings();
    renderStaff();
    renderUpgrades();
    renderAchievements();
    renderStats();
    renderEventBanner();
    renderLevelUnlocks();
    updateQuantitySelector();
    updateButtonStates();
    updateTabBadges();
}
