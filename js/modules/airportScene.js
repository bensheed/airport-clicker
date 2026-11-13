import { SPRITE_SHEET } from './art.js';
import { MAX_RUNWAYS } from './economy.js';

export const SCENE_LOTS = {
    hangar: [94, 204],
    terminal: [280, 204],
    'control-tower': [469, 197],
    hotel: [658, 204],
    'parking-garage': [94, 334],
    'cargo-terminal': [280, 334],
    'fuel-depot': [469, 334],
    'duty-free-mall': [658, 334],
    spaceport: [1023, 265],
};

export function facilityTier(owned) {
    return owned >= 25 ? 3 : owned >= 10 ? 2 : owned > 0 ? 1 : 0;
}

// Only saved purchases and live events drive the scene; animation never earns resources.
export function airportView(state, now = Date.now()) {
    const buildings = state.buildings;
    const owned = id => buildings.find(b => b.id === id)?.owned || 0;
    const built = buildings.filter(b => b.owned > 0).length;
    const next = buildings.find(b => b.owned === 0 && b.unlocked)
        || buildings.find(b => b.owned === 0);
    const stage = owned('spaceport') ? 'Spaceport empire'
        : built >= 7 ? 'International hub'
            : built >= 4 ? 'Regional airport'
                : built > 0 ? 'Local airfield' : 'Grass-strip airfield';
    const activeIds = state.activeEvents.filter(e => e.endsAt > now).map(e => e.id);
    return {
        buildings,
        built,
        stage,
        runways: Math.min(MAX_RUNWAYS, owned('runway')),
        weather: activeIds.includes('weather-delay') ? 'storm'
            : activeIds.includes('clear-skies') ? 'sunny' : 'fair',
        security: activeIds.includes('security-incident'),
        traffic: built > 0,
        cargo: owned('cargo-terminal') > 0,
        terminal: owned('terminal') > 0,
        crew: state.staff.some(s => s.owned > 0),
        upgrades: state.upgrades.filter(u => u.purchased).map(u => u.id),
        hint: next
            ? next.unlocked
                ? `Next on the map: buy your first ${next.name.toLowerCase()}.`
                : `Next on the map: ${next.name}, unlocked at level ${next.unlockLevel}.`
            : 'Room to grow: buildings gain extensions at 10 and 25 owned.',
        summary: `${stage}. ${built} of ${buildings.length} facility types built. ${buildings.filter(b => b.owned > 0).map(b => `${b.name}: ${b.owned}`).join('. ')}`,
    };
}

function sprite(id, x, y, width = 128, height = 112) {
    return `<use href="${SPRITE_SHEET}#${id}" x="${x}" y="${y}" width="${width}" height="${height}"></use>`;
}

function lotMarkup(building) {
    const tier = facilityTier(building.owned);
    const illustration = tier > 0
        ? `${tier >= 3 ? sprite('annex', -17, 1, 98, 92) : ''}${tier >= 2 ? sprite('annex', 64, 17, 83, 80) : ''}${sprite(building.id, 0, 0)}`
        : `<rect class="plot-outline" x="9" y="31" width="110" height="63" rx="8"></rect><path class="plot-cross" d="M57 62h14m-7-7v14"></path>`;
    const label = tier > 0
        ? `${building.name} · ${compactCount(building.owned)}`
        : `${building.name} · ${building.unlocked ? 'Build' : `Lv ${building.unlockLevel}`}`;
    return `${illustration}<text class="lot-label" x="64" y="117" text-anchor="middle">${label}</text>${tier >= 2 ? `<path class="expansion-pip" d="M54 126h8m4 0h8${tier === 3 ? 'm-14 5h8' : ''}"></path>` : ''}`;
}

function compactCount(value) {
    return value >= 1e6 ? `${(value / 1e6).toFixed(1)}M`
        : value >= 1e3 ? `${(value / 1e3).toFixed(1)}K` : String(value);
}

function setText(id, value) {
    const node = document.getElementById(id);
    if (node && node.textContent !== value) node.textContent = value;
}

export function renderAirportScene(state) {
    const panel = document.getElementById('airport-panel');
    const lots = document.getElementById('airport-lots');
    if (!panel || !lots) return;
    const view = airportView(state);
    panel.dataset.weather = view.weather;
    panel.classList.toggle('has-runway', view.runways > 0);
    panel.classList.toggle('has-traffic', view.traffic);
    panel.classList.toggle('has-cargo', view.cargo);
    panel.classList.toggle('has-terminal', view.terminal);
    panel.classList.toggle('has-crew', view.crew);
    panel.classList.toggle('has-security-event', view.security);
    panel.classList.toggle('has-radar', view.upgrades.includes('radar-system'));
    panel.classList.toggle('has-walkways', view.upgrades.includes('moving-walkways'));
    panel.classList.toggle('has-international-gates', view.upgrades.includes('international-gates'));
    panel.classList.toggle('has-galactic-scheduling', view.upgrades.includes('galactic-scheduling'));

    for (const building of view.buildings) {
        const position = SCENE_LOTS[building.id];
        if (!position) continue;
        let lot = document.getElementById(`lot-${building.id}`);
        if (!lot) {
            lot = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            lot.id = `lot-${building.id}`;
            lot.setAttribute('transform', `translate(${position[0]} ${position[1]})`);
            lots.appendChild(lot);
        }
        const signature = `${building.owned}:${building.unlocked}`;
        if (lot.dataset.signature !== signature) {
            lot.dataset.signature = signature;
            lot.setAttribute('class', `scene-lot ${building.owned ? 'is-built' : building.unlocked ? 'is-available' : 'is-locked'}`);
            lot.innerHTML = lotMarkup(building);
        }
    }

    const runwayLights = document.querySelectorAll('.runway-count-light');
    runwayLights.forEach((light, index) => light.classList.toggle('is-on', index < view.runways));
    setText('scene-stage', view.stage);
    setText('scene-hint', view.hint);
    setText('scene-built', `${view.built} / ${view.buildings.length} facilities`);
    setText('scene-upgrades', `${view.upgrades.length} upgrades installed`);
    setText('scene-summary', view.summary);
    setText('runway-count', `RUNWAYS ${view.runways} / ${MAX_RUNWAYS}`);
    setText('scene-weather', view.weather === 'storm' ? 'Weather delay' : view.weather === 'sunny' ? 'Clear skies' : 'Fair weather');
    const traffic = document.getElementById('ambient-traffic');
    if (traffic) traffic.style.setProperty('--traffic-duration', `${Math.max(8, 24 - view.built * 2)}s`);
}

let motionEnabled = true;
let motionQuery;

export function initAirportScene() {
    const panel = document.getElementById('airport-panel');
    const button = document.getElementById('motion-toggle');
    if (!panel || !button) return;
    try { motionEnabled = localStorage.getItem('airportClickerMotion') !== 'off'; } catch (_) { /* Storage can be disabled. */ }
    motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const applyMotion = () => {
        const reduced = Boolean(motionQuery?.matches);
        const enabled = motionEnabled && !reduced;
        panel.classList.toggle('motion-off', !enabled);
        button.textContent = reduced ? 'Reduced motion' : `Motion ${enabled ? 'on' : 'off'}`;
        button.setAttribute('aria-pressed', String(enabled));
        button.disabled = reduced;
        button.title = reduced ? 'Following your system’s reduced-motion preference' : 'Toggle airport animations';
        if (!enabled) document.getElementById('manual-flights')?.replaceChildren();
    };
    button.addEventListener('click', () => {
        motionEnabled = !motionEnabled;
        try { localStorage.setItem('airportClickerMotion', motionEnabled ? 'on' : 'off'); } catch (_) { /* Keep the in-session preference. */ }
        applyMotion();
    });
    motionQuery?.addEventListener('change', applyMotion);
    applyMotion();
}

export function launchFlight() {
    const panel = document.getElementById('airport-panel');
    const flights = document.getElementById('manual-flights');
    if (!panel || !flights || panel.classList.contains('motion-off') || document.hidden || flights.children.length >= 4) return;
    const flight = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    flight.setAttribute('class', 'manual-flight');
    flight.innerHTML = sprite('plane', -130, 72, 114, 100);
    flights.appendChild(flight);
    setTimeout(() => flight.remove(), 3600);
}
