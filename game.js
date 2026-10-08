// game.js — entry point: wire UI handlers, load the save, start the loop.

import { loadGame, saveGame, resetState } from './js/modules/state.js';
import { initUI, refreshAll, addNotification } from './js/modules/ui.js';
import {
    handleMainClick,
    startGameLoop,
    buyBuilding,
    hireStaff,
    purchaseUpgrade,
    setBuyQuantity,
    resetProgress,
} from './js/modules/gameLogic.js';
import { formatNumber } from './js/modules/economy.js';

function initGame() {
    // Fresh state from definitions, then merge any save into it.
    resetState();
    const { loaded, migrated, offlineEarnings } = loadGame();

    initUI({
        onMainClick: handleMainClick,
        onBuyBuilding: buyBuilding,
        onHireStaff: hireStaff,
        onPurchaseUpgrade: purchaseUpgrade,
        onSetQuantity: setBuyQuantity,
        onReset: resetProgress,
    });

    refreshAll();

    if (loaded) {
        addNotification(migrated ? 'Save migrated to the new version. Welcome back!' : 'Game progress loaded.', 'info');
        if (offlineEarnings) {
            const hours = offlineEarnings.seconds / 3600;
            const when = hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(offlineEarnings.seconds / 60)}m`;
            addNotification(
                `While you were away (${when}): +$${formatNumber(offlineEarnings.money)}, +${formatNumber(offlineEarnings.passengers)} passengers`,
                'success'
            );
        }
    } else {
        addNotification('Welcome to Airport Clicker! Click "Operate Flight" to start earning money.', 'info');
    }

    startGameLoop();
}

document.addEventListener('DOMContentLoaded', initGame);

window.addEventListener('beforeunload', () => {
    saveGame();
});
