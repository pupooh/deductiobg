import { BgaCards } from "./libs";
import type { Game } from "./Game";

/**
 * Card managers for Deductio's two card kinds, following the Hearts tutorial
 * pattern (`class XxxManager extends BgaCards.Manager`).
 *
 * Why `BgaCards.Manager` (not `BgaCards.CardManager`)? Studio loads
 * bga-cards from BGA's CDN (x.boardgamearena.net/data/game-libs/bga-cards/
 * 1.x/dist/bga-cards.umd.js), which exports the manager class as `Manager`
 * — `BgaCards.CardManager` does not exist there, so
 * `new BgaCards.CardManager(...)` fails at runtime with
 * "BgaCards.CardManager is not a constructor". The GitHub 1.1.2 code exports
 * it as `CardManager`, but that is a different lineage from what Studio
 * serves. The repo's bga-cards.d.ts / bga-animations.d.ts are the CDN dist
 * typings — do not edit them.
 *
 * Sprites (all displayed at 90x144, half scale):
 * - img/clue_cards.webp 1080x1728, 6x6 grid of 180x288 cells, row-major:
 *   index = clueTypeId - 1, index 35 (bottom-right, pink) = Reveal card.
 * - img/secret_cards.webp 900x1152, 5x4 grid of 180x288 cells:
 *   index = number - 1.
 * - img/card_backs.webp 360x288, two 180x288 cells: left (x=0, blue
 *   "deductio" logo) = clue card back, right (x=180, black with ? cards)
 *   = secret card back. That left/right assignment is an assumption from
 *   the artwork — it needs a Studio visual check.
 */
export const CARD_WIDTH = 90;
export const CARD_HEIGHT = 144;

function clueSpritePosition(clueTypeId: number, isReveal: boolean): string {
    const index = isReveal ? 35 : clueTypeId - 1;
    const col = index % 6;
    const row = Math.floor(index / 6);
    return `${-col * CARD_WIDTH}px ${-row * CARD_HEIGHT}px`;
}

function secretSpritePosition(number: number): string {
    const index = number - 1;
    const col = index % 5;
    const row = Math.floor(index / 5);
    return `${-col * CARD_WIDTH}px ${-row * CARD_HEIGHT}px`;
}

/** Inline background-position for a clue face, for use in plain (non-stock) divs. */
export function clueFaceBackgroundPosition(clueTypeId: number, isReveal: boolean): string {
    return clueSpritePosition(clueTypeId, isReveal);
}

/** Inline background-position for a secret-number face, for use in plain (non-stock) divs. */
export function secretFaceBackgroundPosition(number: number): string {
    return secretSpritePosition(number);
}

export class ClueCardManager extends BgaCards.Manager<ClueCardData> {
    constructor(game: Game) {
        super({
            animationManager: game.animationManager,
            type: 'dd-clue-card',
            getId: (card) => `clue-${card.id}`,
            setupDiv: (card, div) => {
                // Orientation is fixed when the card is created in a stock;
                // updateCardInformations re-runs this when it changes.
                div.classList.toggle('dd-clue-horizontal', card.orientation === 'horizontal');
            },
            setupFrontDiv: (card, div) => {
                if (card.placeholder) {
                    // Face-down placeholder for a discard pile whose contents
                    // are unknown after an F5 refresh: show the card back.
                    div.classList.add('dd-clue-back-face');
                    return;
                }
                div.classList.add('dd-clue-face');
                div.style.backgroundPosition = clueSpritePosition(card.clueTypeId, card.isReveal);
            },
            setupBackDiv: (_card, div) => {
                div.classList.add('dd-clue-back-face');
            },
            // Deck fake cards have no clueTypeId, so they show their back.
            isCardVisible: (card) => card.clueTypeId !== undefined,
            // Horizontal tableau cards are rotated 90deg. The tableau stocks
            // use a wide gap so rotated cards do not overlap their neighbours.
            getCardRotation: (card) => (card.orientation === 'horizontal' ? 90 : 0),
            cardWidth: CARD_WIDTH,
            cardHeight: CARD_HEIGHT,
            cardBorderRadius: '6px',
        });
    }
}

export class SecretCardManager extends BgaCards.Manager<SecretCardData> {
    constructor(game: Game) {
        super({
            animationManager: game.animationManager,
            type: 'dd-secret-card',
            getId: (card) => `secret-${card.id}`,
            setupFrontDiv: (card, div) => {
                div.classList.add('dd-secret-face');
                div.style.backgroundPosition = secretSpritePosition(card.number);
            },
            setupBackDiv: (_card, div) => {
                div.classList.add('dd-secret-back-face');
            },
            // Only cards the viewer is allowed to see show their front:
            // the viewer's own secret, revealed secrets, guessed secrets.
            // Opponents' current secrets and deck fake cards show the back.
            isCardVisible: (card) => card.visible === true,
            cardWidth: CARD_WIDTH,
            cardHeight: CARD_HEIGHT,
            cardBorderRadius: '6px',
        });
    }
}
