[![Play on GitHub Pages](https://img.shields.io/badge/Play-Now-brightgreen?style=for-the-badge&logo=github)](https://bensheed.github.io/airport-clicker/)

# Airport Clicker

An incremental game inspired by [CivClicker](https://kastark.co.uk/games/civclicker/) (David Holley, GPL). Grow a tiny airfield into a spaceport empire.

## Game Overview

Click "Operate Flight" to earn money and passengers, then reinvest in buildings, staff, and upgrades. Lifetime passengers earn reputation, which levels up your airport and unlocks new content through level 12.

### Resources

- **Money**: Spent on buildings, staff, and upgrades
- **Passengers**: Accumulate from flights and buildings; lifetime passengers determine reputation
- **Reputation**: `totalPassengers / 10` — drives your airport level

### Buildings

| Building | Unlock | Role |
|----------|--------|------|
| Runway | L1 | Passive income; each one boosts all other buildings by +10% (max 8) |
| Terminal | L1 | Passenger processing and shops |
| Hangar | L1 | Aircraft maintenance income |
| Control Tower | L2 | Dense flight schedules |
| Parking Garage | L3 | Parking fees |
| Cargo Terminal | L4 | Freight income |
| Airport Hotel | L5 | Layover spending |
| Fuel Depot | L6 | Fuel sales |
| Duty-Free Mall | L7 | Retail empire |
| Spaceport | L8 | Suborbital flights (endgame) |

### Staff

- **Pilot**: +4% money per flight
- **Flight Attendant**: +8% passengers per flight
- **Ground Crew** (L2): +3% passenger production
- **Mechanic** (L2): +5% building income
- **Security Officer** (L3): +4% passenger production; reduces the chance of bad events
- **Air Traffic Controller** (L4): +4% to all money income

### Upgrades

Ten one-time purchases with permanent effects — click multipliers, per-building boosts, and global multipliers, unlocked from level 1 through 9.

### Events

Random events fire every ~45–100 seconds: VIP charters, clear skies, celebrity visits, school tours, weather delays, and security incidents. Timed events show as live chips above the flight button.

### Quality of life

- Bulk buying (×1 / ×10 / ×100 / Max)
- Achievements (15 of them — see the Achievements tab)
- Offline earnings at 50% rate, capped at 4 hours
- Autosave every 15s and on exit; v1 saves migrate automatically

## The Living Airport

Little River is an illustrated airport that grows with your saved purchases:

- Your first runway paves the grass strip; eight runway lights track the runway cap.
- Each of the other nine building types has a reserved plot. Buying the first one adds it to the map; owning 10 and 25 adds extensions instead of overcrowding the scene.
- Operating a flight launches an aircraft. A developed airport also has ambient departures, cargo aircraft, staff vehicles, and passengers.
- Weather delays add storm shading and rain; clear skies brighten the scene. Selected upgrades add walkways, international gates, radar, and an orbital route.
- Every building, staff role, upgrade, and achievement has matching original SVG art.

The map scrolls horizontally on small screens without shrinking the controls. A motion toggle persists separately from the save, and system reduced-motion preferences are always respected. The map has a text equivalent for screen readers. Animations are decorative: they do not change income or flight counts, and existing saves need no migration.

### Working with the artwork

`assets/airport.svg` contains the reusable, hand-authored sprite symbols, and `assets/airfield.svg` is the landscape. All illustrations are original to this project; no third-party art, external fonts, or build tooling is required. Use `artIcon(id)` from `js/modules/art.js` for a shop thumbnail. Definition IDs match sprite IDs, and regression tests check that all content has artwork.

`js/modules/airportScene.js` derives a visual model from game state and updates only changed building lots. Keep long-running animated elements outside the shop renderer so purchases do not restart flights. Add new building coordinates to `SCENE_LOTS`; do not save DOM nodes or animation state in the game save.

## Running the Game

```bash
npm start          # serves http://localhost:12000
# or any static server — the game is plain ES modules
```

## Running Tests

```bash
npm install
npm test           # jest via Node's experimental VM modules (ESM)
```

## Tech

Vanilla HTML/CSS/JS, ES modules, no build step. `js/modules/economy.js` is a pure, DOM-free core (costs, production rates, multipliers, levels, formatting) that the test suite exercises directly.

## License

MIT
