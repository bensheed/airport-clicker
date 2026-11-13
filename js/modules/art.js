// One original sprite sheet, shared by the airport and shop.
export const SPRITE_SHEET = 'assets/airport.svg';

export function artIcon(id, className = '') {
    return `<svg class="art-icon ${className}" viewBox="0 0 128 112" aria-hidden="true" focusable="false"><use href="${SPRITE_SHEET}#${id}" width="128" height="112"></use></svg>`;
}
