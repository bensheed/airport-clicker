import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { createInitialState } from './js/modules/state.js';
import { buildingDefinitions, staffDefinitions, upgradeDefinitions, achievementDefinitions, eventDefinitions } from './js/modules/definitions.js';
import { artIcon } from './js/modules/art.js';
import { SCENE_LOTS, airportView, facilityTier, renderAirportScene, initAirportScene, launchFlight } from './js/modules/airportScene.js';

describe('original artwork', () => {
    const sheet = readFileSync(new URL('./assets/airport.svg', import.meta.url), 'utf8');
    const ids = [...sheet.matchAll(/<symbol id="([^"]+)"/g)].map(match => match[1]);

    test.each([...buildingDefinitions, ...staffDefinitions, ...upgradeDefinitions, ...achievementDefinitions, ...eventDefinitions])('$id has an original sprite', item => {
        expect(ids).toContain(item.id);
        expect(artIcon(item.id)).toContain(`assets/airport.svg#${item.id}`);
    });

    test('all shared sprite references exist and IDs are unique', () => {
        expect(new Set(ids).size).toBe(ids.length);
        for (const [, id] of sheet.matchAll(/href="#([^"]+)"/g)) expect(ids).toContain(id);
        expect(sheet).not.toMatch(/<script|(?:href|src)="https?:\/\//);
    });

    test('all non-runway buildings have a reserved plot inside the map', () => {
        expect(Object.keys(SCENE_LOTS).sort()).toEqual(buildingDefinitions.filter(b => b.id !== 'runway').map(b => b.id).sort());
        for (const [x, y] of Object.values(SCENE_LOTS)) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x + 147).toBeLessThanOrEqual(1200);
            expect(y + 132).toBeLessThanOrEqual(500);
        }
    });

    test('thumbnail artwork is decorative and cannot steal keyboard focus', () => {
        expect(artIcon('terminal')).toContain('aria-hidden="true"');
        expect(artIcon('terminal')).toContain('focusable="false"');
    });
});

describe('airport visual model', () => {
    let state;
    const own = (state, id, count = 1) => { state.buildings.find(b => b.id === id).owned = count; };
    beforeEach(() => { state = createInitialState(); });

    test('a new save starts as an empty grass-strip airfield', () => {
        const view = airportView(state);
        expect(view).toMatchObject({ built: 0, stage: 'Grass-strip airfield', runways: 0, weather: 'fair', traffic: false });
        expect(view.hint).toBe('Next on the map: buy your first runway.');
    });

    test('owning a facility, not merely unlocking it, changes the map', () => {
        state.buildings.forEach(b => { b.unlocked = true; });
        expect(airportView(state).built).toBe(0);
        own(state, 'runway');
        expect(airportView(state)).toMatchObject({ built: 1, runways: 1, stage: 'Local airfield', traffic: true });
        expect(airportView(state).hint).toContain('terminal');
    });

    test('higher ownership adds bounded extensions at the documented thresholds', () => {
        expect([0, 1, 9, 10, 24, 25, 1e6].map(facilityTier)).toEqual([0, 1, 1, 2, 2, 3, 3]);
    });

    test('milestones follow the built airport, including a purchased spaceport', () => {
        state.buildings.slice(0, 4).forEach(b => { b.owned = 1; });
        expect(airportView(state).stage).toBe('Regional airport');
        state.buildings.slice(0, 7).forEach(b => { b.owned = 1; });
        expect(airportView(state).stage).toBe('International hub');
        own(state, 'spaceport');
        expect(airportView(state).stage).toBe('Spaceport empire');
    });

    test('expired events do not affect weather; storms take priority over clear skies', () => {
        state.activeEvents = [{ id: 'weather-delay', endsAt: 1000 }, { id: 'clear-skies', endsAt: 3000 }];
        expect(airportView(state, 999).weather).toBe('storm');
        expect(airportView(state, 1000).weather).toBe('sunny');
        expect(airportView(state, 3000).weather).toBe('fair');
    });

    test('cargo, crew, passengers, and improvements reflect purchases', () => {
        own(state, 'cargo-terminal');
        own(state, 'terminal');
        state.staff[0].owned = 1;
        state.upgrades.find(u => u.id === 'radar-system').purchased = true;
        expect(airportView(state)).toMatchObject({ cargo: true, terminal: true, crew: true, upgrades: ['radar-system'] });
    });

    test('next construction guidance handles level locks and a complete airport', () => {
        state.buildings.filter(b => b.unlocked).forEach(b => { b.owned = 1; });
        expect(airportView(state).hint).toContain('Control Tower, unlocked at level 2');
        state.buildings.forEach(b => { b.owned = 1; });
        expect(airportView(state).hint).toContain('extensions at 10 and 25');
    });

    test('deriving the scene never mutates the economy or saved purchases', () => {
        own(state, 'runway', 999);
        const before = JSON.stringify(state);
        expect(airportView(state).runways).toBe(8);
        expect(JSON.stringify(state)).toBe(before);
    });
});

// A small SVG DOM fixture keeps the renderer tests independent of a browser/build step.
describe('persistent scene renderer and motion controls', () => {
    let nodes, state, media, stored;
    const makeNode = () => {
        const classes = new Set();
        let markup = '';
        const node = {
            dataset: {}, children: [], textContent: '', writes: 0, attributes: {}, listeners: {},
            classList: {
                toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
                contains: name => classes.has(name),
            },
            style: { setProperty: jest.fn() },
            setAttribute(name, value) { this.attributes[name] = value; },
            addEventListener(name, callback) { this.listeners[name] = callback; },
            appendChild(child) { this.children.push(child); child.parent = this; if (child.id) nodes.set(child.id, child); },
            replaceChildren() { this.children = []; },
            remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
        };
        Object.defineProperty(node, 'innerHTML', {
            get: () => markup,
            set: value => { markup = value; node.writes++; },
        });
        return node;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        nodes = new Map();
        stored = {};
        for (const id of ['airport-panel', 'airport-lots', 'scene-stage', 'scene-hint', 'scene-built', 'scene-upgrades', 'scene-summary', 'runway-count', 'scene-weather', 'ambient-traffic', 'manual-flights', 'motion-toggle']) {
            nodes.set(id, makeNode());
        }
        global.document = {
            hidden: false,
            getElementById: id => nodes.get(id) || null,
            querySelectorAll: () => [],
            createElementNS: jest.fn(() => makeNode()),
        };
        media = { matches: false, addEventListener: jest.fn() };
        global.window = { matchMedia: () => media };
        global.localStorage = { getItem: key => stored[key] ?? null, setItem: (key, value) => { stored[key] = value; } };
        state = createInitialState();
    });
    afterEach(() => { jest.useRealTimers(); });

    test('unchanged ticks preserve SVG nodes, markup, and in-flight aircraft', () => {
        renderAirportScene(state);
        const lot = nodes.get('lot-terminal');
        launchFlight();
        const flight = nodes.get('manual-flights').children[0];
        state.money += 5;
        renderAirportScene(state);
        expect(nodes.get('lot-terminal')).toBe(lot);
        expect(lot.writes).toBe(1);
        expect(nodes.get('airport-lots').children).toHaveLength(9);
        expect(nodes.get('manual-flights').children[0]).toBe(flight);
    });

    test('a purchase only redraws its own plot and extensions stay bounded', () => {
        renderAirportScene(state);
        const terminal = state.buildings.find(b => b.id === 'terminal');
        terminal.owned = 10;
        renderAirportScene(state);
        expect(nodes.get('lot-terminal').innerHTML).toContain('airport.svg#terminal');
        expect(nodes.get('lot-terminal').innerHTML.match(/#annex/g)).toHaveLength(1);
        expect(nodes.get('lot-hangar').writes).toBe(1);
        terminal.owned = 1000000;
        renderAirportScene(state);
        expect(nodes.get('lot-terminal').innerHTML.match(/#annex/g)).toHaveLength(2);
        expect(nodes.get('lot-terminal').innerHTML).toContain('1.0M');
    });

    test('reset removes buildings, upgrades, weather, and ambient traffic', () => {
        state.buildings.forEach(b => { b.owned = 25; });
        state.upgrades.forEach(u => { u.purchased = true; });
        state.activeEvents = [{ id: 'weather-delay', endsAt: Date.now() + 60000 }];
        renderAirportScene(state);
        expect(nodes.get('airport-panel').classList.contains('has-runway')).toBe(true);
        renderAirportScene(createInitialState());
        const panel = nodes.get('airport-panel');
        expect(panel.classList.contains('has-runway')).toBe(false);
        expect(panel.classList.contains('has-radar')).toBe(false);
        expect(panel.classList.contains('has-traffic')).toBe(false);
        expect(panel.dataset.weather).toBe('fair');
        expect(nodes.get('lot-terminal').innerHTML).not.toContain('airport.svg#terminal');
    });

    test('rapid manual departures are capped and removed without changing game state', () => {
        const before = JSON.stringify(state);
        for (let i = 0; i < 50; i++) launchFlight();
        expect(nodes.get('manual-flights').children).toHaveLength(4);
        jest.advanceTimersByTime(3600);
        expect(nodes.get('manual-flights').children).toHaveLength(0);
        expect(JSON.stringify(state)).toBe(before);
    });

    test('motion preference persists and pausing clears queued departures', () => {
        initAirportScene();
        launchFlight();
        const button = nodes.get('motion-toggle');
        button.listeners.click();
        expect(stored.airportClickerMotion).toBe('off');
        expect(button.attributes['aria-pressed']).toBe('false');
        expect(nodes.get('manual-flights').children).toHaveLength(0);
        launchFlight();
        expect(nodes.get('manual-flights').children).toHaveLength(0);
        button.listeners.click();
        expect(stored.airportClickerMotion).toBe('on');
        launchFlight();
        expect(nodes.get('manual-flights').children).toHaveLength(1);
    });

    test('system reduced motion takes precedence and responds to live preference changes', () => {
        media.matches = true;
        initAirportScene();
        expect(nodes.get('airport-panel').classList.contains('motion-off')).toBe(true);
        expect(nodes.get('motion-toggle').disabled).toBe(true);
        launchFlight();
        expect(nodes.get('manual-flights').children).toHaveLength(0);
        media.matches = false;
        media.addEventListener.mock.calls[0][1]();
        expect(nodes.get('airport-panel').classList.contains('motion-off')).toBe(false);
        expect(nodes.get('motion-toggle').disabled).toBe(false);
    });

    test('disabled storage and missing matchMedia do not prevent play', () => {
        localStorage.getItem = () => { throw new Error('blocked'); };
        localStorage.setItem = () => { throw new Error('blocked'); };
        window.matchMedia = undefined;
        expect(() => initAirportScene()).not.toThrow();
        expect(() => nodes.get('motion-toggle').listeners.click()).not.toThrow();
    });

    test('headless consumers and a hidden page do not create aircraft', () => {
        document.hidden = true;
        launchFlight();
        expect(nodes.get('manual-flights').children).toHaveLength(0);
        nodes.clear();
        expect(() => renderAirportScene(state)).not.toThrow();
        expect(() => initAirportScene()).not.toThrow();
        expect(() => launchFlight()).not.toThrow();
    });
});
