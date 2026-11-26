/*
To use the BGA libs, add `import { BgaAnimations, BgaCards } from "./libs";` in the files using them.

To get the latest typing files (that you would save at the root of your game), read the lib doc and see the demo, go to:
https://doc.studio.boardgamearena.com/framework-documentation/front-end/libs/bga-animations/
https://doc.studio.boardgamearena.com/framework-documentation/front-end/libs/bga-cards/
*/
/*
 * Studio loads bga-cards / bga-animations from BGA's CDN
 * (x.boardgamearena.net/data/game-libs/ - 1.x dist UMD builds), NOT from
 * GitHub thoun/bga-cards. The CDN build exports the manager as `Manager`
 * (settings-only constructor); the GitHub 1.1.2 code exports `CardManager`
 * (game, settings) — a different lineage. Trust the CDN dist .d.ts files
 * at the repo root, never the GitHub tags or doc pages.
 */
const BgaAnimations = await globalThis.importEsmLib('bga-animations', '1.x');
const BgaCards = await globalThis.importEsmLib('bga-cards', '1.x');

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
const CARD_WIDTH = 90;
const CARD_HEIGHT = 144;
function clueSpritePosition(clueTypeId, isReveal) {
    const index = isReveal ? 35 : clueTypeId - 1;
    const col = index % 6;
    const row = Math.floor(index / 6);
    return `${-col * CARD_WIDTH}px ${-row * CARD_HEIGHT}px`;
}
function secretSpritePosition(number) {
    const index = number - 1;
    const col = index % 5;
    const row = Math.floor(index / 5);
    return `${-col * CARD_WIDTH}px ${-row * CARD_HEIGHT}px`;
}
/** Inline background-position for a clue face, for use in plain (non-stock) divs. */
function clueFaceBackgroundPosition(clueTypeId, isReveal) {
    return clueSpritePosition(clueTypeId, isReveal);
}
/** Inline background-position for a secret-number face, for use in plain (non-stock) divs. */
function secretFaceBackgroundPosition(number) {
    return secretSpritePosition(number);
}
class ClueCardManager extends BgaCards.Manager {
    constructor(game) {
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
class SecretCardManager extends BgaCards.Manager {
    constructor(game) {
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

const CLUE_DEFINITIONS = {
    // 1..10: Double-number exclusions
    1: { category: 'not_in_set', label: '≠ 10, 20', ability: null, values: [10, 20] },
    2: { category: 'not_in_set', label: '≠ 1, 11', ability: null, values: [1, 11] },
    3: { category: 'not_in_set', label: '≠ 2, 12', ability: null, values: [2, 12] },
    4: { category: 'not_in_set', label: '≠ 3, 13', ability: null, values: [3, 13] },
    5: { category: 'not_in_set', label: '≠ 4, 14', ability: null, values: [4, 14] },
    6: { category: 'not_in_set', label: '≠ 5, 15', ability: null, values: [5, 15] },
    7: { category: 'not_in_set', label: '≠ 6, 16', ability: null, values: [6, 16] },
    8: { category: 'not_in_set', label: '≠ 7, 17', ability: null, values: [7, 17] },
    9: { category: 'not_in_set', label: '≠ 8, 18', ability: null, values: [8, 18] },
    10: { category: 'not_in_set', label: '≠ 9, 19', ability: null, values: [9, 19] },
    // 11..14: 5-number exclusions
    11: { category: 'not_in_set', label: '≠ 1, 6, 9, 14, 17', ability: null, values: [1, 6, 9, 14, 17] },
    12: { category: 'not_in_set', label: '≠ 2, 5, 10, 13, 18', ability: null, values: [2, 5, 10, 13, 18] },
    13: { category: 'not_in_set', label: '≠ 3, 8, 11, 16, 19', ability: null, values: [3, 8, 11, 16, 19] },
    14: { category: 'not_in_set', label: '≠ 4, 7, 12, 15, 20', ability: null, values: [4, 7, 12, 15, 20] },
    // 15..19: Range exclusions
    15: { category: 'not_in_set', label: '≠ 1–4', ability: null, values: [1, 2, 3, 4] },
    16: { category: 'not_in_set', label: '≠ 5–8', ability: null, values: [5, 6, 7, 8] },
    17: { category: 'not_in_set', label: '≠ 9–12', ability: null, values: [9, 10, 11, 12] },
    18: { category: 'not_in_set', label: '≠ 13–16', ability: null, values: [13, 14, 15, 16] },
    19: { category: 'not_in_set', label: '≠ 17–20', ability: null, values: [17, 18, 19, 20] },
    // 20..22: Lower bounds
    20: { category: 'gte', label: '≥ 6', ability: null, min: 6 },
    21: { category: 'gte', label: '≥ 7', ability: null, min: 7 },
    22: { category: 'gte', label: '≥ 8', ability: null, min: 8 },
    // 23..25: Upper bounds
    23: { category: 'lte', label: '≤ 13', ability: null, max: 13 },
    24: { category: 'lte', label: '≤ 14', ability: null, max: 14 },
    25: { category: 'lte', label: '≤ 15', ability: null, max: 15 },
    // 26..29: Parity / digit count + Free Guess
    26: { category: 'parity', label: 'Even (2, 4, 6...)', ability: 'free_guess', parity: 'even' },
    27: { category: 'parity', label: 'Odd (1, 3, 5...)', ability: 'free_guess', parity: 'odd' },
    28: { category: 'digits', label: 'Single digit (1–9)', ability: 'free_guess', digits: 'single' },
    29: { category: 'digits', label: 'Double digit (10–20)', ability: 'free_guess', digits: 'double' },
    // 30..31: Adjacent to face-up Secret Number + Look at 1 Card
    30: { category: 'offset_from_revealed', label: '+1 from face-up Secret Number', ability: 'look_1', offset: 1 },
    31: { category: 'offset_from_revealed', label: '-1 from face-up Secret Number', ability: 'look_1', offset: -1 },
    // 32..35: Range + Look at 2 Cards
    32: { category: 'range', label: '= 1–5', ability: 'look_2', min: 1, max: 5 },
    33: { category: 'range', label: '= 6–10', ability: 'look_2', min: 6, max: 10 },
    34: { category: 'range', label: '= 11–15', ability: 'look_2', min: 11, max: 15 },
    35: { category: 'range', label: '= 16–20', ability: 'look_2', min: 16, max: 20 },
};
function getClueDefinition(clueTypeId) {
    return CLUE_DEFINITIONS[clueTypeId];
}
function getClueAbility(clueTypeId) {
    return CLUE_DEFINITIONS[clueTypeId]?.ability ?? null;
}
/**
 * Mirror of Material::isClueTrueForNumber. `faceUpSecrets` are the numbers
 * on face-up Secret Number cards in the center of the table.
 */
function isClueTrueForNumber(clueTypeId, secretNumber, faceUpSecrets) {
    const def = CLUE_DEFINITIONS[clueTypeId];
    if (!def)
        return false;
    switch (def.category) {
        case 'not_in_set':
            return !(def.values ?? []).includes(secretNumber);
        case 'gte':
            return secretNumber >= (def.min ?? 0);
        case 'lte':
            return secretNumber <= (def.max ?? 0);
        case 'range':
            return secretNumber >= (def.min ?? 0) && secretNumber <= (def.max ?? 0);
        case 'parity':
            return (secretNumber % 2 === 0) === (def.parity === 'even');
        case 'digits':
            return (secretNumber >= 10) === (def.digits === 'double');
        case 'offset_from_revealed':
            return faceUpSecrets.includes(secretNumber - (def.offset ?? 0));
        default:
            return false;
    }
}

/**
 * PlayerTurn (state 10, ACTIVE_PLAYER).
 *
 * On the active player's turn, truthful Clue cards in the row are computed
 * locally from their own Secret Number + the revealed secrets and made
 * clickable (the server re-validates every play — this highlighting is UX
 * only). If no row card is truthful, the "Take All 3 (Horizontal)" action
 * is offered instead. Guessing is available unless this is a penalty turn.
 */
class PlayerTurn {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.args = args;
        const penalty = args.penaltyRemaining ?? 0;
        if (isCurrentPlayerActive) {
            if (penalty > 0) {
                this.bga.statusBar.setTitle(_('${you} must play a Clue card (penalty — ${remaining} left)'), { remaining: penalty });
            }
            else {
                this.bga.statusBar.setTitle(_('${you} must play a truthful Clue card, take all 3, or guess a Secret Number'));
            }
            // The truthful cards can only be computed once the setup
            // addCards have placed the row cards in the stock: setup()
            // does not await setupInitialCards, so evaluating here
            // synchronously would see an empty stock and wrongly offer
            // "Take All 3". Defer until the stocks are ready (same pattern
            // as Deep Dive's applyWhenStocksReady).
            const token = this.game.nextRowInteractivityToken();
            this.game.applyWhenStocksReady(token, () => {
                const truthful = this.game.getTruthfulRowCards();
                if (truthful.length > 0) {
                    this.game.setRowSelectionMode('single', truthful);
                }
                else {
                    this.game.setRowSelectionMode('none');
                    this.bga.statusBar.addActionButton(_('Take All 3 (Horizontal)'), () => this.game.playAllHorizontal(), { color: 'primary' });
                }
            });
            if (args.canGuess) {
                this.game.setGuessAllowed(true);
                this.bga.statusBar.addActionButton(_('Guess a Secret Number'), () => this.game.openGuessPicker(), { color: 'secondary' });
            }
            else {
                this.game.setGuessAllowed(false);
            }
        }
        else {
            this.bga.statusBar.setTitle(penalty > 0
                ? _('${actplayer} must play a Clue card (penalty — ${remaining} left)')
                : _('${actplayer} must play a Clue card'), { remaining: penalty });
            this.game.setGuessAllowed(false);
        }
    }
    onLeavingState(_args, _isCurrentPlayerActive) {
        // Invalidate any deferred selection apply still waiting on the stocks.
        this.game.nextRowInteractivityToken();
        this.game.setRowSelectionMode('none');
        this.game.setGuessAllowed(false);
        this.game.closeGuessPicker();
    }
}

/**
 * FreeGuess (state 20, ACTIVE_PLAYER). Entered after playing a Clue card
 * with the Free Guess ability: the active player may guess one Secret
 * Number with no penalty for a wrong guess, or skip the free guess.
 */
class FreeGuess {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    onEnteringState(_args, isCurrentPlayerActive) {
        if (isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(_('${you} may make a Free Guess (no penalty if wrong), or skip it'));
            this.game.setGuessAllowed(true);
            this.bga.statusBar.addActionButton(_('Make a Free Guess'), () => this.game.openGuessPicker(), { color: 'primary' });
            this.bga.statusBar.addActionButton(_('Skip Free Guess'), () => this.game.skipFreeGuess(), { color: 'secondary' });
        }
        else {
            this.bga.statusBar.setTitle(_('${actplayer} may make a Free Guess'));
            this.game.setGuessAllowed(false);
        }
    }
    onLeavingState(_args, _isCurrentPlayerActive) {
        this.game.setGuessAllowed(false);
        this.game.closeGuessPicker();
    }
}

/**
 * LookAtCards (state 25, ACTIVE_PLAYER). Entered after playing a Clue card
 * with the Look at 1/2 Cards ability. The peeked Secret Number cards come
 * from the private peekSecretCards notification (or from getAllDatas on an
 * F5 refresh) and are shown in a modal; the player may swap the order of
 * 2 cards before putting them on the bottom of the deck.
 */
class LookAtCards {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.args = args;
        if (isCurrentPlayerActive) {
            const count = args.count ?? 0;
            this.bga.statusBar.setTitle(count === 1
                ? _('${you} must look at 1 Secret Number card and put it on the bottom of the deck')
                : _('${you} must look at ${count} Secret Number cards and put them on the bottom of the deck'), { count });
            this.game.openPeekModal();
        }
        else {
            this.bga.statusBar.setTitle(_('${actplayer} is looking at Secret Number cards'));
        }
    }
    onLeavingState(_args, _isCurrentPlayerActive) {
        this.game.closePeekModal();
    }
}

/**
 * EndScore (state 98, GAME). The remaining Secret Numbers are revealed via
 * the revealRemainingSecrets notification; this state only sets the title.
 */
class EndScore {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.args = {};
    }
    onEnteringState(_args, _isCurrentPlayerActive) {
        this.bga.statusBar.setTitle(_('The game is over — the remaining Secret Numbers are revealed'));
    }
}

/**
 * Deductio frontend (Phase 3).
 *
 * Card zones use bga-cards (see CardManagers.ts): a Secret deck + face-up
 * Revealed Secrets row, a Clue deck + discard pile + 3-card Clue Row in the
 * center, and per-player areas with that player's Secret card (face-up to
 * themself, card-back to opponents), face-up Guessed Secrets, and a Clue
 * Tableau (vertical cards upright, horizontal cards rotated 90deg).
 *
 * Hidden information: the client only ever knows the viewing player's own
 * Secret Number (mySecretCard), the revealed secrets, and guessed secrets.
 * Opponents' current secrets are face-down placeholders whose number the
 * client does not know.
 */
class Game {
    constructor(bga) {
        this.currentPlayerId = 0;
        this.mySecretCard = null;
        this.revealedNumbers = [];
        this.peekedCards = null;
        this.clueCardsById = new Map();
        this.secretCardsById = new Map();
        /** Resolves once the setup addCards calls have placed every card. */
        this.stocksReady = Promise.resolve();
        /** Bumped by every row-interactivity change; stale deferred applies are ignored. */
        this.rowInteractivityToken = 0;
        this.tableauStocks = new Map();
        this.secretStocks = new Map();
        this.guessedStocks = new Map();
        /** True while the viewing player may open the guess picker (their PlayerTurn with canGuess, or FreeGuess). */
        this.guessAllowed = false;
        // Guess picker state
        this.pickerTargetId = null;
        this.pickerSelectedNumber = null;
        // Peek modal state
        this.peekOrder = [];
        this.peekSelectedIndex = null;
        // Deduction notepad: manual marks per opponent, persisted in localStorage.
        this.notepadMarks = new Map();
        console.log('deductiobg constructor');
        this.bga = bga;
        this.bga.states.register('PlayerTurn', new PlayerTurn(this, bga));
        this.bga.states.register('FreeGuess', new FreeGuess(this, bga));
        this.bga.states.register('LookAtCards', new LookAtCards(this, bga));
        this.bga.states.register('EndScore', new EndScore(this, bga));
    }
    setup(gamedatas) {
        console.log("Starting game setup", gamedatas);
        this.gamedatas = gamedatas;
        this.currentPlayerId = this.bga.players.getCurrentPlayerId();
        this.mySecretCard = gamedatas.mySecretCard ?? null;
        this.revealedNumbers = (gamedatas.revealedSecrets ?? []).map((c) => c.number);
        this.peekedCards = gamedatas.peekedCards ?? null;
        this.animationManager = new BgaAnimations.Manager({
            animationsActive: () => this.bga.gameui.bgaAnimationsActive(),
        });
        this.clueManager = new ClueCardManager(this);
        this.secretManager = new SecretCardManager(this);
        this.renderTableHtml(gamedatas);
        this.createStocks();
        this.stocksReady = this.setupInitialCards(gamedatas);
        this.loadNotepadMarks();
        this.refreshNotepads();
        // User preference 100: Deduction Notepad Auto-Mark (default 1).
        try {
            this.bga.userPreferences.onChange = (prefId, _value) => {
                if (prefId === 100)
                    this.refreshNotepads();
            };
        }
        catch (e) {
            console.log('userPreferences.onChange not available', e);
        }
        this.setupNotifications();
        console.log("Ending game setup");
    }
    ///////////////////////////////////////////////////
    //// Layout
    renderTableHtml(gamedatas) {
        const playerTables = (gamedatas.playerorder ?? Object.keys(gamedatas.players).map(Number))
            .map((playerId) => {
            const player = gamedatas.players[playerId];
            const isMe = playerId === this.currentPlayerId;
            return `
                <div id="dd-player-table-${playerId}" class="dd-player-table${isMe ? ' dd-player-table-me' : ''}">
                    <div class="dd-player-header">
                        <strong style="color: #${player.color}">${player.name}</strong>
                        ${isMe ? `<span class="dd-you-badge">${_('You')}</span>` : ''}
                        <span class="dd-secret-label">${_('Secret Number')}</span>
                        ${isMe ? '' : `<button type="button" class="dd-guess-btn" data-player-id="${playerId}">${_('Guess')}</button>`}
                    </div>
                    <div class="dd-player-secret-row">
                        <div id="dd-secret-stock-${playerId}" class="dd-stock dd-secret-stock"></div>
                        <div class="dd-guessed-zone">
                            <div class="dd-mini-label">${_('Guessed')}</div>
                            <div id="dd-guessed-stock-${playerId}" class="dd-stock dd-guessed-stock"></div>
                        </div>
                    </div>
                    <div class="dd-mini-label">${_('Clue tableau')}</div>
                    <div id="dd-tableau-stock-${playerId}" class="dd-stock dd-tableau-stock"></div>
                    ${isMe ? '' : `
                    <div class="dd-notepad" id="dd-notepad-${playerId}">
                        <button type="button" class="dd-notepad-toggle" data-player-id="${playerId}">${_('Deduction notepad')} ▾</button>
                        <div class="dd-notepad-grid" id="dd-notepad-grid-${playerId}" hidden></div>
                    </div>`}
                </div>`;
        })
            .join('');
        this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
            <div id="dd-table">
                <div id="dd-center">
                    <div class="dd-zone" id="dd-secret-zone">
                        <div class="dd-zone-title">${_('Secret Numbers')}</div>
                        <div class="dd-deck-row">
                            <div class="dd-deck-wrap">
                                <div id="dd-secret-deck" class="dd-deck"></div>
                                <div class="dd-deck-count" id="dd-secret-deck-count"></div>
                                <div class="dd-deck-label">${_('Deck')}</div>
                            </div>
                            <div class="dd-revealed-wrap">
                                <div id="dd-revealed-stock" class="dd-stock dd-revealed-stock"></div>
                                <div class="dd-deck-label">${_('Revealed — nobody can have these')}</div>
                            </div>
                        </div>
                    </div>
                    <div class="dd-zone" id="dd-clue-zone">
                        <div class="dd-zone-title">${_('Clue Row')}</div>
                        <div class="dd-deck-row">
                            <div class="dd-deck-wrap">
                                <div id="dd-clue-deck" class="dd-deck"></div>
                                <div class="dd-deck-count" id="dd-clue-deck-count"></div>
                                <div class="dd-deck-label">${_('Deck')}</div>
                            </div>
                            <div id="dd-clue-row-stock" class="dd-stock dd-clue-row-stock"></div>
                            <div class="dd-deck-wrap">
                                <div id="dd-clue-discard" class="dd-deck"></div>
                                <div class="dd-deck-count" id="dd-clue-discard-count"></div>
                                <div class="dd-deck-label">${_('Discard')}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="dd-player-tables">${playerTables}</div>
            </div>
            <div id="dd-guess-modal" class="dd-modal" hidden>
                <div class="dd-modal-box">
                    <div class="dd-modal-title">${_('Guess a Secret Number')}</div>
                    <div class="dd-modal-targets" id="dd-guess-targets"></div>
                    <div class="dd-modal-numbers" id="dd-guess-numbers"></div>
                    <div class="dd-modal-hint">${_('Numbers already revealed or guessed are dimmed — they cannot be anyone’s Secret Number.')}</div>
                    <button type="button" id="dd-guess-cancel" class="dd-modal-cancel">${_('Cancel')}</button>
                </div>
            </div>
            <div id="dd-peek-modal" class="dd-modal" hidden>
                <div class="dd-modal-box">
                    <div class="dd-modal-title">${_('Look at Secret Number cards')}</div>
                    <div class="dd-modal-hint">${_('Click two cards to swap their order, then put them on the bottom of the deck.')}</div>
                    <div class="dd-peek-cards" id="dd-peek-cards"></div>
                    <button type="button" id="dd-peek-return" class="dd-modal-confirm">${_('Put on Bottom of Deck')}</button>
                </div>
            </div>
        `);
        // Guess buttons on the player panels (side bar) as well as in the player areas.
        for (const [pId, player] of Object.entries(gamedatas.players)) {
            const playerId = Number(pId);
            if (playerId === this.currentPlayerId)
                continue;
            this.bga.playerPanels.getElement(playerId).insertAdjacentHTML('beforeend', `
                <button type="button" class="dd-guess-btn dd-guess-btn-panel" data-player-id="${playerId}">${_('Guess')}</button>
            `);
            void player;
        }
        document.querySelectorAll('.dd-guess-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetId = Number(btn.dataset.playerId);
                this.openGuessPicker(targetId);
            });
        });
        document.getElementById('dd-guess-cancel')?.addEventListener('click', () => this.closeGuessPicker());
        document.getElementById('dd-peek-return')?.addEventListener('click', () => this.returnPeekedCards());
    }
    createStocks() {
        const el = (id) => document.getElementById(id);
        this.secretDeck = new BgaCards.Deck(this.secretManager, el('dd-secret-deck'), {});
        this.revealedStock = new BgaCards.LineStock(this.secretManager, el('dd-revealed-stock'), {
            wrap: 'wrap', center: false, gap: '8px', sort: BgaCards.sort('number'),
        });
        this.clueDeck = new BgaCards.Deck(this.clueManager, el('dd-clue-deck'), {});
        this.clueRowStock = new BgaCards.LineStock(this.clueManager, el('dd-clue-row-stock'), {
            wrap: 'wrap', center: true, gap: '8px', sort: BgaCards.sort('slot'),
        });
        this.clueRowStock.onCardClick = (card) => this.playClue(card);
        this.clueDiscardStock = new BgaCards.DiscardDeck(this.clueManager, el('dd-clue-discard'), {});
        for (const playerId of Object.keys(this.gamedatas.players).map(Number)) {
            const tableau = new BgaCards.LineStock(this.clueManager, el(`dd-tableau-stock-${playerId}`), {
                // Wide gap: horizontal cards are rotated 90deg and extend
                // ~27px past their 90px layout box on each side.
                wrap: 'wrap', center: false, gap: '56px',
            });
            this.tableauStocks.set(playerId, tableau);
            const secretStock = new BgaCards.LineStock(this.secretManager, el(`dd-secret-stock-${playerId}`), {
                wrap: 'nowrap', center: false, gap: '8px',
                cardClickEventFilter: 'all',
            });
            secretStock.onCardClick = () => this.openGuessPicker(playerId);
            this.secretStocks.set(playerId, secretStock);
            const guessed = new BgaCards.LineStock(this.secretManager, el(`dd-guessed-stock-${playerId}`), {
                wrap: 'wrap', center: false, gap: '8px', sort: BgaCards.sort('number'),
            });
            this.guessedStocks.set(playerId, guessed);
        }
    }
    async setupInitialCards(gamedatas) {
        const promises = [];
        await this.secretDeck.setCardNumber(gamedatas.secretDeckCount);
        this.setBadge('dd-secret-deck-count', gamedatas.secretDeckCount);
        await this.clueDeck.setCardNumber(gamedatas.clueDeckCount);
        this.setBadge('dd-clue-deck-count', gamedatas.clueDeckCount);
        this.updateDiscardCount(gamedatas.clueDiscardCount);
        for (const secret of gamedatas.revealedSecrets ?? []) {
            promises.push(this.revealedStock.addCard(this.ensureSecretCard({ ...secret, visible: true })));
        }
        for (const [slot, card] of Object.entries(gamedatas.clueRow ?? {})) {
            promises.push(this.clueRowStock.addCard(this.ensureClueCard({ ...card, orientation: 'vertical', slot: Number(slot) })));
        }
        // The server does not send discard contents, only its count: show a
        // face-down placeholder while the pile is non-empty after an F5.
        if (gamedatas.clueDiscardCount > 0) {
            promises.push(this.clueDiscardStock.addCard(this.ensureClueCard({
                id: -1, clueTypeId: 0, isReveal: false, orientation: 'vertical', placeholder: true,
            })));
        }
        for (const [pId, player] of Object.entries(gamedatas.players)) {
            const playerId = Number(pId);
            const secretStock = this.secretStocks.get(playerId);
            const guessedStock = this.guessedStocks.get(playerId);
            const tableauStock = this.tableauStocks.get(playerId);
            if (playerId === this.currentPlayerId && this.mySecretCard) {
                promises.push(secretStock.addCard(this.ensureSecretCard({ ...this.mySecretCard, visible: true })));
            }
            else {
                // Opponent (or spectator view): a face-down card whose number
                // this client does not know. Negative id, unique per player.
                promises.push(secretStock.addCard(this.ensureSecretCard({ id: -playerId, number: 0, visible: false })));
            }
            for (const secret of player.guessedSecrets ?? []) {
                promises.push(guessedStock.addCard(this.ensureSecretCard({ ...secret, visible: true })));
            }
            for (const clue of player.tableau ?? []) {
                promises.push(tableauStock.addCard(this.ensureClueCard({ ...clue })));
            }
        }
        await Promise.all(promises);
    }
    ///////////////////////////////////////////////////
    //// Card registries (one data object per card id, mutated in place)
    ensureClueCard(card) {
        const existing = this.clueCardsById.get(card.id);
        if (existing) {
            Object.assign(existing, card);
            return existing;
        }
        this.clueCardsById.set(card.id, card);
        return card;
    }
    ensureSecretCard(card) {
        const existing = this.secretCardsById.get(card.id);
        if (existing) {
            Object.assign(existing, card);
            return existing;
        }
        this.secretCardsById.set(card.id, card);
        return card;
    }
    getClueCard(id) {
        return this.clueCardsById.get(id);
    }
    getSecretCard(id) {
        return this.secretCardsById.get(id);
    }
    ///////////////////////////////////////////////////
    //// Deck counts / badges
    setBadge(id, count) {
        const badge = document.getElementById(id);
        if (badge)
            badge.textContent = String(count);
    }
    async updateDeckCounts(secretCount, clueCount, discardCount) {
        if (secretCount !== undefined) {
            await this.secretDeck.setCardNumber(secretCount);
            this.setBadge('dd-secret-deck-count', secretCount);
        }
        if (clueCount !== undefined) {
            await this.clueDeck.setCardNumber(clueCount);
            this.setBadge('dd-clue-deck-count', clueCount);
        }
        if (discardCount !== undefined) {
            this.updateDiscardCount(discardCount);
        }
    }
    updateDiscardCount(count) {
        this.setBadge('dd-clue-discard-count', count);
    }
    ///////////////////////////////////////////////////
    //// Truth evaluation (UX highlighting only — the server validates plays)
    getTruthfulRowCards() {
        if (!this.mySecretCard)
            return [];
        return this.clueRowStock.getCards().filter((card) => !card.isReveal && isClueTrueForNumber(card.clueTypeId, this.mySecretCard.number, this.revealedNumbers));
    }
    setRowSelectionMode(mode, selectable) {
        this.clueRowStock.setSelectionMode(mode, selectable);
    }
    /** Run fn once the setup stocks are populated, unless row interactivity moved on. */
    applyWhenStocksReady(token, fn) {
        void this.stocksReady.then(() => {
            if (token === this.rowInteractivityToken)
                fn();
        });
    }
    /** Bump the row-interactivity token; returns the new token. */
    nextRowInteractivityToken() {
        return ++this.rowInteractivityToken;
    }
    setGuessAllowed(allowed) {
        this.guessAllowed = allowed;
        document.querySelectorAll('.dd-guess-btn').forEach((btn) => {
            btn.classList.toggle('dd-disabled', !allowed);
        });
    }
    isGuessAllowed() {
        return this.guessAllowed;
    }
    ///////////////////////////////////////////////////
    //// Player actions
    playClue(card) {
        if (!this.bga.players.isCurrentPlayerActive())
            return;
        void this.bga.actions.performAction('actPlayClue', { cardId: card.id });
    }
    playAllHorizontal() {
        void this.bga.actions.performAction('actPlayAllHorizontal', {});
    }
    skipFreeGuess() {
        void this.bga.actions.performAction('actSkipFreeGuess', {});
    }
    ///////////////////////////////////////////////////
    //// Guess picker (1–20)
    /** Numbers no player can have: revealed + guessed by anyone + my own secret. */
    getImpossibleNumbers() {
        const impossible = new Set(this.revealedNumbers);
        for (const stock of this.guessedStocks.values()) {
            for (const card of stock.getCards())
                impossible.add(card.number);
        }
        if (this.mySecretCard)
            impossible.add(this.mySecretCard.number);
        return impossible;
    }
    openGuessPicker(targetPlayerId) {
        if (!this.guessAllowed)
            return;
        const opponents = Object.keys(this.gamedatas.players)
            .map(Number)
            .filter((id) => id !== this.currentPlayerId);
        if (opponents.length === 0)
            return;
        this.pickerTargetId = targetPlayerId !== undefined && opponents.includes(targetPlayerId)
            ? targetPlayerId
            : opponents[0];
        this.pickerSelectedNumber = null;
        this.renderGuessPicker();
        document.getElementById('dd-guess-modal').hidden = false;
    }
    closeGuessPicker() {
        document.getElementById('dd-guess-modal').hidden = true;
        this.pickerTargetId = null;
        this.pickerSelectedNumber = null;
    }
    renderGuessPicker() {
        const targetsEl = document.getElementById('dd-guess-targets');
        const numbersEl = document.getElementById('dd-guess-numbers');
        const impossible = this.getImpossibleNumbers();
        const opponents = Object.keys(this.gamedatas.players)
            .map(Number)
            .filter((id) => id !== this.currentPlayerId);
        targetsEl.innerHTML = '';
        for (const opponentId of opponents) {
            const player = this.gamedatas.players[opponentId];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dd-picker-target' + (opponentId === this.pickerTargetId ? ' dd-selected' : '');
            btn.textContent = player.name;
            btn.addEventListener('click', () => {
                this.pickerTargetId = opponentId;
                this.renderGuessPicker();
            });
            targetsEl.appendChild(btn);
        }
        numbersEl.innerHTML = '';
        for (let n = 1; n <= 20; n++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dd-picker-number' + (impossible.has(n) ? ' dd-dimmed' : '');
            btn.textContent = String(n);
            btn.disabled = impossible.has(n);
            btn.addEventListener('click', () => this.confirmGuess(n));
            numbersEl.appendChild(btn);
        }
    }
    confirmGuess(number) {
        if (this.pickerTargetId === null)
            return;
        const targetId = this.pickerTargetId;
        const isFreeGuess = this.bga.states.getCurrentMainStateName() === 'FreeGuess';
        this.closeGuessPicker();
        void this.bga.actions.performAction(isFreeGuess ? 'actFreeGuess' : 'actGuess', {
            targetPlayerId: targetId,
            number,
        });
    }
    ///////////////////////////////////////////////////
    //// LookAtCards modal
    getPeekedCards() {
        return this.peekedCards;
    }
    setPeekedCards(cards) {
        this.peekedCards = cards;
    }
    openPeekModal() {
        const cards = this.peekedCards;
        if (!cards || cards.length === 0)
            return;
        this.peekOrder = cards.map((c) => ({ ...c, visible: true }));
        this.peekSelectedIndex = null;
        this.renderPeekModal();
        document.getElementById('dd-peek-modal').hidden = false;
    }
    closePeekModal() {
        document.getElementById('dd-peek-modal').hidden = true;
        this.peekOrder = [];
        this.peekSelectedIndex = null;
    }
    renderPeekModal() {
        const container = document.getElementById('dd-peek-cards');
        container.innerHTML = '';
        this.peekOrder.forEach((card, index) => {
            const div = document.createElement('div');
            div.className = 'dd-peek-card dd-secret-face' + (index === this.peekSelectedIndex ? ' dd-peek-selected' : '');
            div.style.backgroundPosition = secretFaceBackgroundPosition(card.number);
            div.title = String(card.number);
            div.addEventListener('click', () => this.onPeekCardClick(index));
            container.appendChild(div);
        });
    }
    onPeekCardClick(index) {
        if (this.peekOrder.length < 2)
            return;
        if (this.peekSelectedIndex === null) {
            this.peekSelectedIndex = index;
        }
        else if (this.peekSelectedIndex === index) {
            this.peekSelectedIndex = null;
        }
        else {
            const other = this.peekSelectedIndex;
            [this.peekOrder[other], this.peekOrder[index]] = [this.peekOrder[index], this.peekOrder[other]];
            this.peekSelectedIndex = null;
        }
        this.renderPeekModal();
    }
    returnPeekedCards() {
        const orderedIds = this.peekOrder.map((c) => c.id);
        if (orderedIds.length === 0)
            return;
        this.closePeekModal();
        void this.bga.actions.performAction('actReturnPeekedCards', { orderedCardIds: orderedIds });
    }
    ///////////////////////////////////////////////////
    //// Deduction notepad
    getTableId() {
        return new URLSearchParams(window.location.search).get('table') ?? '0';
    }
    getAutoMarkEnabled() {
        try {
            return this.bga.userPreferences.get(100) !== 0;
        }
        catch (e) {
            // Preference API unavailable: default to auto-mark on.
            return true;
        }
    }
    loadNotepadMarks() {
        try {
            const raw = localStorage.getItem(`deductiobg-notepad-${this.getTableId()}-${this.currentPlayerId}`);
            if (!raw)
                return;
            const parsed = JSON.parse(raw);
            for (const [pId, numbers] of Object.entries(parsed)) {
                this.notepadMarks.set(Number(pId), new Set(numbers));
            }
        }
        catch (e) {
            console.log('could not load notepad marks', e);
        }
    }
    saveNotepadMarks() {
        try {
            const out = {};
            for (const [pId, numbers] of this.notepadMarks.entries()) {
                out[pId] = [...numbers];
            }
            localStorage.setItem(`deductiobg-notepad-${this.getTableId()}-${this.currentPlayerId}`, JSON.stringify(out));
        }
        catch (e) {
            console.log('could not save notepad marks', e);
        }
    }
    /** Rebuild every notepad grid from the current auto-marked + manual sets. */
    refreshNotepads() {
        const auto = this.getAutoMarkEnabled() ? this.getImpossibleNumbers() : new Set();
        for (const playerId of Object.keys(this.gamedatas.players).map(Number)) {
            if (playerId === this.currentPlayerId)
                continue;
            const grid = document.getElementById(`dd-notepad-grid-${playerId}`);
            if (!grid)
                continue;
            const manual = this.notepadMarks.get(playerId) ?? new Set();
            grid.innerHTML = '';
            for (let n = 1; n <= 20; n++) {
                const eliminated = auto.has(n) || manual.has(n);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'dd-notepad-cell' + (eliminated ? ' dd-eliminated' : '') + (auto.has(n) ? ' dd-auto' : '');
                btn.textContent = String(n);
                btn.title = auto.has(n) ? _('Publicly impossible') : _('Click to mark eliminated / possible');
                btn.addEventListener('click', () => {
                    const marks = this.notepadMarks.get(playerId) ?? new Set();
                    if (marks.has(n))
                        marks.delete(n);
                    else
                        marks.add(n);
                    this.notepadMarks.set(playerId, marks);
                    this.saveNotepadMarks();
                    this.refreshNotepads();
                });
                grid.appendChild(btn);
            }
            const toggle = document.querySelector(`.dd-notepad-toggle[data-player-id="${playerId}"]`);
            if (toggle && !toggle.dataset.bound) {
                toggle.dataset.bound = '1';
                toggle.addEventListener('click', () => {
                    grid.hidden = !grid.hidden;
                    toggle.textContent = `${_('Deduction notepad')} ${grid.hidden ? '▾' : '▴'}`;
                });
            }
        }
    }
    ///////////////////////////////////////////////////
    //// Reaction to cometD notifications
    setupNotifications() {
        console.log('notifications subscriptions setup');
        this.bga.notifications.setupPromiseNotifications({
        // logger: console.log
        });
    }
    async moveClueToDiscard(card) {
        const fromStock = this.clueManager.getCardStock(card);
        const placeholder = this.clueDiscardStock.getCards().find((c) => c.placeholder);
        if (placeholder)
            await this.clueDiscardStock.removeCard(placeholder);
        if (fromStock) {
            await this.clueDiscardStock.addCard(card, { fromStock });
        }
        else if (!this.clueDiscardStock.contains(card)) {
            await this.clueDiscardStock.addCard(card);
        }
    }
    async notif_cluePlayedVertical(args) {
        const card = this.ensureClueCard({ ...args.card, orientation: 'vertical', slot: undefined });
        const tableau = this.tableauStocks.get(args.player_id);
        if (tableau) {
            await tableau.addCard(card, { fromStock: this.clueRowStock });
        }
    }
    async notif_cluesPlayedHorizontal(args) {
        const tableau = this.tableauStocks.get(args.player_id);
        if (!tableau)
            return;
        for (const raw of args.cards) {
            const card = this.ensureClueCard({ ...raw, orientation: 'horizontal', slot: undefined });
            await tableau.addCard(card, { fromStock: this.clueRowStock });
        }
    }
    async notif_clueRowReplenished(args) {
        const card = this.ensureClueCard({ ...args.card, orientation: 'vertical', slot: args.slot });
        if (!this.clueRowStock.contains(card)) {
            await this.clueRowStock.addCard(card);
        }
        await this.updateDeckCounts(undefined, args.clueDeckCount, args.clueDiscardCount);
    }
    async notif_revealCardTriggered(args) {
        if (args.revealedSecret) {
            const secret = this.ensureSecretCard({ ...args.revealedSecret, visible: true });
            if (!this.revealedStock.contains(secret)) {
                await this.revealedStock.addCard(secret);
            }
            if (args.number !== null && !this.revealedNumbers.includes(args.number)) {
                this.revealedNumbers.push(args.number);
            }
            this.refreshNotepads();
        }
        for (const raw of args.discardedAdjacent ?? []) {
            await this.moveClueToDiscard(this.ensureClueCard({ ...raw }));
        }
        await this.updateDeckCounts(args.secretDeckCount, args.clueDeckCount, args.clueDiscardCount);
    }
    async notif_guessCorrect(args) {
        const targetStock = this.secretStocks.get(args.target_id);
        if (targetStock) {
            for (const old of [...targetStock.getCards()]) {
                await targetStock.removeCard(old);
            }
        }
        const secret = this.ensureSecretCard({ ...args.secretCard, visible: true });
        const guessedStock = this.guessedStocks.get(args.player_id);
        if (guessedStock && !guessedStock.contains(secret)) {
            await guessedStock.addCard(secret, { fromElement: targetStock?.getElement() });
        }
        try {
            this.bga.playerPanels.getScoreCounter(args.player_id).setValue(args.newScore);
        }
        catch (e) {
            console.log('could not update score counter', e);
        }
        if (args.target_id === this.currentPlayerId) {
            this.mySecretCard = null;
        }
        this.refreshNotepads();
    }
    async notif_guessIncorrect(_args) {
        // No card movement; the log message carries the news. A wrong guess
        // leads to a penalty turn, handled by the PlayerTurn state.
    }
    async notif_tableauDiscardedForNewSecret(args) {
        for (const raw of args.discardedCards ?? []) {
            await this.moveClueToDiscard(this.ensureClueCard({ ...raw }));
        }
        if (args.hasNewSecret) {
            const secretStock = this.secretStocks.get(args.target_id);
            if (secretStock && secretStock.isEmpty()) {
                // The target's new secret is face-down to everyone but them;
                // the real card arrives for the target via newSecretCard.
                await secretStock.addCard(this.ensureSecretCard({ id: -args.target_id, number: 0, visible: false }));
            }
        }
        await this.updateDeckCounts(args.secretDeckCount, undefined, args.clueDiscardCount);
    }
    async notif_newSecretCard(args) {
        // Private notification: only the target receives this.
        this.mySecretCard = { ...args.secretCard, visible: true };
        const secretStock = this.secretStocks.get(this.currentPlayerId);
        if (secretStock) {
            for (const old of [...secretStock.getCards()]) {
                await secretStock.removeCard(old);
            }
            await secretStock.addCard(this.ensureSecretCard(this.mySecretCard));
        }
        this.refreshNotepads();
    }
    async notif_peekSecretCards(args) {
        this.peekedCards = args.cards.map((c) => ({ ...c, visible: true }));
        if (this.bga.states.getCurrentMainStateName() === 'LookAtCards' && this.bga.players.isCurrentPlayerActive()) {
            this.openPeekModal();
        }
    }
    async notif_freeGuessSkipped(_args) {
        // No card movement.
    }
    async notif_peekedCardsReturned(_args) {
        this.peekedCards = null;
        this.closePeekModal();
    }
    async notif_revealRemainingSecrets(args) {
        for (const [pId, raw] of Object.entries(args.secrets ?? {})) {
            const playerId = Number(pId);
            const secret = this.ensureSecretCard({ ...raw, visible: true });
            const secretStock = this.secretStocks.get(playerId);
            if (!secretStock)
                continue;
            for (const old of [...secretStock.getCards()]) {
                await secretStock.removeCard(old);
            }
            await secretStock.addCard(secret);
            if (playerId === this.currentPlayerId) {
                this.mySecretCard = secret;
            }
        }
    }
}

export { Game };
