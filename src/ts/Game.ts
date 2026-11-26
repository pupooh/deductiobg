import { BgaAnimations, BgaCards } from "./libs";
import { ClueCardManager, SecretCardManager, secretFaceBackgroundPosition } from "./CardManagers";
import { isClueTrueForNumber } from "./Material";
import { PlayerTurn } from "./States/PlayerTurn";
import { FreeGuess } from "./States/FreeGuess";
import { LookAtCards } from "./States/LookAtCards";
import { EndScore } from "./States/EndScore";

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
export class Game {
    public bga: Bga<deductiobgPlayer, deductiobgGamedatas>;
    public animationManager!: BgaAnimations.Manager;
    public clueManager!: ClueCardManager;
    public secretManager!: SecretCardManager;

    private gamedatas!: deductiobgGamedatas;
    private currentPlayerId = 0;
    private mySecretCard: SecretCardData | null = null;
    private revealedNumbers: number[] = [];
    private peekedCards: SecretCardData[] | null = null;

    private clueCardsById = new Map<number, ClueCardData>();
    private secretCardsById = new Map<number, SecretCardData>();

    private clueRowStock!: BgaCards.LineStock<ClueCardData>;
    private clueDeck!: BgaCards.Deck<ClueCardData>;
    private clueDiscardStock!: BgaCards.DiscardDeck<ClueCardData>;
    private secretDeck!: BgaCards.Deck<SecretCardData>;
    private revealedStock!: BgaCards.LineStock<SecretCardData>;
    private tableauStocks = new Map<number, BgaCards.LineStock<ClueCardData>>();
    private secretStocks = new Map<number, BgaCards.LineStock<SecretCardData>>();
    private guessedStocks = new Map<number, BgaCards.LineStock<SecretCardData>>();

    /** True while the viewing player may open the guess picker (their PlayerTurn with canGuess, or FreeGuess). */
    private guessAllowed = false;

    // Guess picker state
    private pickerTargetId: number | null = null;
    private pickerSelectedNumber: number | null = null;

    // Peek modal state
    private peekOrder: SecretCardData[] = [];
    private peekSelectedIndex: number | null = null;

    // Deduction notepad: manual marks per opponent, persisted in localStorage.
    private notepadMarks = new Map<number, Set<number>>();

    constructor(bga: Bga<deductiobgPlayer, deductiobgGamedatas>) {
        console.log('deductiobg constructor');
        this.bga = bga;

        this.bga.states.register('PlayerTurn', new PlayerTurn(this, bga));
        this.bga.states.register('FreeGuess', new FreeGuess(this, bga));
        this.bga.states.register('LookAtCards', new LookAtCards(this, bga));
        this.bga.states.register('EndScore', new EndScore(this, bga));
    }

    setup(gamedatas: deductiobgGamedatas) {
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
        this.setupInitialCards(gamedatas);
        this.loadNotepadMarks();
        this.refreshNotepads();

        // User preference 100: Deduction Notepad Auto-Mark (default 1).
        try {
            this.bga.userPreferences.onChange = (prefId: number, _value: number) => {
                if (prefId === 100) this.refreshNotepads();
            };
        } catch (e) {
            console.log('userPreferences.onChange not available', e);
        }

        this.setupNotifications();
        console.log("Ending game setup");
    }

    ///////////////////////////////////////////////////
    //// Layout

    private renderTableHtml(gamedatas: deductiobgGamedatas) {
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
            if (playerId === this.currentPlayerId) continue;
            this.bga.playerPanels.getElement(playerId).insertAdjacentHTML('beforeend', `
                <button type="button" class="dd-guess-btn dd-guess-btn-panel" data-player-id="${playerId}">${_('Guess')}</button>
            `);
            void player;
        }

        document.querySelectorAll<HTMLElement>('.dd-guess-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetId = Number(btn.dataset.playerId);
                this.openGuessPicker(targetId);
            });
        });
        document.getElementById('dd-guess-cancel')?.addEventListener('click', () => this.closeGuessPicker());
        document.getElementById('dd-peek-return')?.addEventListener('click', () => this.returnPeekedCards());
    }

    private createStocks() {
        const el = (id: string) => document.getElementById(id)!;

        this.secretDeck = new BgaCards.Deck<SecretCardData>(this.secretManager, el('dd-secret-deck'), {});
        this.revealedStock = new BgaCards.LineStock<SecretCardData>(this.secretManager, el('dd-revealed-stock'), {
            wrap: 'wrap', center: false, gap: '8px', sort: BgaCards.sort<SecretCardData>('number'),
        });
        this.clueDeck = new BgaCards.Deck<ClueCardData>(this.clueManager, el('dd-clue-deck'), {});
        this.clueRowStock = new BgaCards.LineStock<ClueCardData>(this.clueManager, el('dd-clue-row-stock'), {
            wrap: 'wrap', center: true, gap: '8px', sort: BgaCards.sort<ClueCardData>('slot'),
        });
        this.clueRowStock.onCardClick = (card) => this.playClue(card);
        this.clueDiscardStock = new BgaCards.DiscardDeck<ClueCardData>(this.clueManager, el('dd-clue-discard'), {});

        for (const playerId of Object.keys(this.gamedatas.players).map(Number)) {
            const tableau = new BgaCards.LineStock<ClueCardData>(this.clueManager, el(`dd-tableau-stock-${playerId}`), {
                // Wide gap: horizontal cards are rotated 90deg and extend
                // ~27px past their 90px layout box on each side.
                wrap: 'wrap', center: false, gap: '56px',
            });
            this.tableauStocks.set(playerId, tableau);

            const secretStock = new BgaCards.LineStock<SecretCardData>(this.secretManager, el(`dd-secret-stock-${playerId}`), {
                wrap: 'nowrap', center: false, gap: '8px',
                cardClickEventFilter: 'all',
            });
            secretStock.onCardClick = () => this.openGuessPicker(playerId);
            this.secretStocks.set(playerId, secretStock);

            const guessed = new BgaCards.LineStock<SecretCardData>(this.secretManager, el(`dd-guessed-stock-${playerId}`), {
                wrap: 'wrap', center: false, gap: '8px', sort: BgaCards.sort<SecretCardData>('number'),
            });
            this.guessedStocks.set(playerId, guessed);
        }
    }

    private async setupInitialCards(gamedatas: deductiobgGamedatas) {
        const promises: Promise<boolean>[] = [];

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
            const secretStock = this.secretStocks.get(playerId)!;
            const guessedStock = this.guessedStocks.get(playerId)!;
            const tableauStock = this.tableauStocks.get(playerId)!;

            if (playerId === this.currentPlayerId && this.mySecretCard) {
                promises.push(secretStock.addCard(this.ensureSecretCard({ ...this.mySecretCard, visible: true })));
            } else {
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

    private ensureClueCard(card: ClueCardData): ClueCardData {
        const existing = this.clueCardsById.get(card.id);
        if (existing) {
            Object.assign(existing, card);
            return existing;
        }
        this.clueCardsById.set(card.id, card);
        return card;
    }

    private ensureSecretCard(card: SecretCardData): SecretCardData {
        const existing = this.secretCardsById.get(card.id);
        if (existing) {
            Object.assign(existing, card);
            return existing;
        }
        this.secretCardsById.set(card.id, card);
        return card;
    }

    private getClueCard(id: number): ClueCardData | undefined {
        return this.clueCardsById.get(id);
    }

    private getSecretCard(id: number): SecretCardData | undefined {
        return this.secretCardsById.get(id);
    }

    ///////////////////////////////////////////////////
    //// Deck counts / badges

    private setBadge(id: string, count: number) {
        const badge = document.getElementById(id);
        if (badge) badge.textContent = String(count);
    }

    private async updateDeckCounts(secretCount?: number, clueCount?: number, discardCount?: number) {
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

    private updateDiscardCount(count: number) {
        this.setBadge('dd-clue-discard-count', count);
    }

    ///////////////////////////////////////////////////
    //// Truth evaluation (UX highlighting only — the server validates plays)

    public getTruthfulRowCards(): ClueCardData[] {
        if (!this.mySecretCard) return [];
        return this.clueRowStock.getCards().filter((card) =>
            !card.isReveal && isClueTrueForNumber(card.clueTypeId, this.mySecretCard!.number, this.revealedNumbers)
        );
    }

    public setRowSelectionMode(mode: 'none' | 'single', selectable?: ClueCardData[]) {
        this.clueRowStock.setSelectionMode(mode, selectable);
    }

    public setGuessAllowed(allowed: boolean) {
        this.guessAllowed = allowed;
        document.querySelectorAll<HTMLElement>('.dd-guess-btn').forEach((btn) => {
            btn.classList.toggle('dd-disabled', !allowed);
        });
    }

    public isGuessAllowed(): boolean {
        return this.guessAllowed;
    }

    ///////////////////////////////////////////////////
    //// Player actions

    private playClue(card: ClueCardData) {
        if (!this.bga.players.isCurrentPlayerActive()) return;
        void this.bga.actions.performAction('actPlayClue', { cardId: card.id });
    }

    public playAllHorizontal() {
        void this.bga.actions.performAction('actPlayAllHorizontal', {});
    }

    public skipFreeGuess() {
        void this.bga.actions.performAction('actSkipFreeGuess', {});
    }

    ///////////////////////////////////////////////////
    //// Guess picker (1–20)

    /** Numbers no player can have: revealed + guessed by anyone + my own secret. */
    private getImpossibleNumbers(): Set<number> {
        const impossible = new Set<number>(this.revealedNumbers);
        for (const stock of this.guessedStocks.values()) {
            for (const card of stock.getCards()) impossible.add(card.number);
        }
        if (this.mySecretCard) impossible.add(this.mySecretCard.number);
        return impossible;
    }

    public openGuessPicker(targetPlayerId?: number) {
        if (!this.guessAllowed) return;
        const opponents = Object.keys(this.gamedatas.players)
            .map(Number)
            .filter((id) => id !== this.currentPlayerId);
        if (opponents.length === 0) return;
        this.pickerTargetId = targetPlayerId !== undefined && opponents.includes(targetPlayerId)
            ? targetPlayerId
            : opponents[0];
        this.pickerSelectedNumber = null;
        this.renderGuessPicker();
        document.getElementById('dd-guess-modal')!.hidden = false;
    }

    public closeGuessPicker() {
        document.getElementById('dd-guess-modal')!.hidden = true;
        this.pickerTargetId = null;
        this.pickerSelectedNumber = null;
    }

    private renderGuessPicker() {
        const targetsEl = document.getElementById('dd-guess-targets')!;
        const numbersEl = document.getElementById('dd-guess-numbers')!;
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

    private confirmGuess(number: number) {
        if (this.pickerTargetId === null) return;
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

    public getPeekedCards(): SecretCardData[] | null {
        return this.peekedCards;
    }

    public setPeekedCards(cards: SecretCardData[] | null) {
        this.peekedCards = cards;
    }

    public openPeekModal() {
        const cards = this.peekedCards;
        if (!cards || cards.length === 0) return;
        this.peekOrder = cards.map((c) => ({ ...c, visible: true }));
        this.peekSelectedIndex = null;
        this.renderPeekModal();
        document.getElementById('dd-peek-modal')!.hidden = false;
    }

    public closePeekModal() {
        document.getElementById('dd-peek-modal')!.hidden = true;
        this.peekOrder = [];
        this.peekSelectedIndex = null;
    }

    private renderPeekModal() {
        const container = document.getElementById('dd-peek-cards')!;
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

    private onPeekCardClick(index: number) {
        if (this.peekOrder.length < 2) return;
        if (this.peekSelectedIndex === null) {
            this.peekSelectedIndex = index;
        } else if (this.peekSelectedIndex === index) {
            this.peekSelectedIndex = null;
        } else {
            const other = this.peekSelectedIndex;
            [this.peekOrder[other], this.peekOrder[index]] = [this.peekOrder[index], this.peekOrder[other]];
            this.peekSelectedIndex = null;
        }
        this.renderPeekModal();
    }

    private returnPeekedCards() {
        const orderedIds = this.peekOrder.map((c) => c.id);
        if (orderedIds.length === 0) return;
        this.closePeekModal();
        void this.bga.actions.performAction('actReturnPeekedCards', { orderedCardIds: orderedIds });
    }

    ///////////////////////////////////////////////////
    //// Deduction notepad

    private getTableId(): string {
        return new URLSearchParams(window.location.search).get('table') ?? '0';
    }

    private getAutoMarkEnabled(): boolean {
        try {
            return this.bga.userPreferences.get(100) !== 0;
        } catch (e) {
            // Preference API unavailable: default to auto-mark on.
            return true;
        }
    }

    private loadNotepadMarks() {
        try {
            const raw = localStorage.getItem(`deductiobg-notepad-${this.getTableId()}-${this.currentPlayerId}`);
            if (!raw) return;
            const parsed = JSON.parse(raw) as { [playerId: string]: number[] };
            for (const [pId, numbers] of Object.entries(parsed)) {
                this.notepadMarks.set(Number(pId), new Set(numbers));
            }
        } catch (e) {
            console.log('could not load notepad marks', e);
        }
    }

    private saveNotepadMarks() {
        try {
            const out: { [playerId: string]: number[] } = {};
            for (const [pId, numbers] of this.notepadMarks.entries()) {
                out[pId] = [...numbers];
            }
            localStorage.setItem(`deductiobg-notepad-${this.getTableId()}-${this.currentPlayerId}`, JSON.stringify(out));
        } catch (e) {
            console.log('could not save notepad marks', e);
        }
    }

    /** Rebuild every notepad grid from the current auto-marked + manual sets. */
    public refreshNotepads() {
        const auto = this.getAutoMarkEnabled() ? this.getImpossibleNumbers() : new Set<number>();
        for (const playerId of Object.keys(this.gamedatas.players).map(Number)) {
            if (playerId === this.currentPlayerId) continue;
            const grid = document.getElementById(`dd-notepad-grid-${playerId}`);
            if (!grid) continue;
            const manual = this.notepadMarks.get(playerId) ?? new Set<number>();
            grid.innerHTML = '';
            for (let n = 1; n <= 20; n++) {
                const eliminated = auto.has(n) || manual.has(n);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'dd-notepad-cell' + (eliminated ? ' dd-eliminated' : '') + (auto.has(n) ? ' dd-auto' : '');
                btn.textContent = String(n);
                btn.title = auto.has(n) ? _('Publicly impossible') : _('Click to mark eliminated / possible');
                btn.addEventListener('click', () => {
                    const marks = this.notepadMarks.get(playerId) ?? new Set<number>();
                    if (marks.has(n)) marks.delete(n);
                    else marks.add(n);
                    this.notepadMarks.set(playerId, marks);
                    this.saveNotepadMarks();
                    this.refreshNotepads();
                });
                grid.appendChild(btn);
            }
            const toggle = document.querySelector<HTMLElement>(`.dd-notepad-toggle[data-player-id="${playerId}"]`);
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

    private async moveClueToDiscard(card: ClueCardData) {
        const fromStock = this.clueManager.getCardStock(card);
        const placeholder = this.clueDiscardStock.getCards().find((c) => c.placeholder);
        if (placeholder) await this.clueDiscardStock.removeCard(placeholder);
        if (fromStock) {
            await this.clueDiscardStock.addCard(card, { fromStock });
        } else if (!this.clueDiscardStock.contains(card)) {
            await this.clueDiscardStock.addCard(card);
        }
    }

    async notif_cluePlayedVertical(args: CluePlayedVerticalArgs) {
        const card = this.ensureClueCard({ ...args.card, orientation: 'vertical', slot: undefined });
        const tableau = this.tableauStocks.get(args.player_id);
        if (tableau) {
            await tableau.addCard(card, { fromStock: this.clueRowStock });
        }
    }

    async notif_cluesPlayedHorizontal(args: CluesPlayedHorizontalArgs) {
        const tableau = this.tableauStocks.get(args.player_id);
        if (!tableau) return;
        for (const raw of args.cards) {
            const card = this.ensureClueCard({ ...raw, orientation: 'horizontal', slot: undefined });
            await tableau.addCard(card, { fromStock: this.clueRowStock });
        }
    }

    async notif_clueRowReplenished(args: ClueRowReplenishedArgs) {
        const card = this.ensureClueCard({ ...args.card, orientation: 'vertical', slot: args.slot });
        if (!this.clueRowStock.contains(card)) {
            await this.clueRowStock.addCard(card);
        }
        await this.updateDeckCounts(undefined, args.clueDeckCount, args.clueDiscardCount);
    }

    async notif_revealCardTriggered(args: RevealCardTriggeredArgs) {
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

    async notif_guessCorrect(args: GuessCorrectArgs) {
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
        } catch (e) {
            console.log('could not update score counter', e);
        }
        if (args.target_id === this.currentPlayerId) {
            this.mySecretCard = null;
        }
        this.refreshNotepads();
    }

    async notif_guessIncorrect(_args: GuessIncorrectArgs) {
        // No card movement; the log message carries the news. A wrong guess
        // leads to a penalty turn, handled by the PlayerTurn state.
    }

    async notif_tableauDiscardedForNewSecret(args: TableauDiscardedForNewSecretArgs) {
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

    async notif_newSecretCard(args: NewSecretCardArgs) {
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

    async notif_peekSecretCards(args: PeekSecretCardsArgs) {
        this.peekedCards = args.cards.map((c) => ({ ...c, visible: true }));
        if (this.bga.states.getCurrentMainStateName() === 'LookAtCards' && this.bga.players.isCurrentPlayerActive()) {
            this.openPeekModal();
        }
    }

    async notif_freeGuessSkipped(_args: FreeGuessSkippedArgs) {
        // No card movement.
    }

    async notif_peekedCardsReturned(_args: PeekedCardsReturnedArgs) {
        this.peekedCards = null;
        this.closePeekModal();
    }

    async notif_revealRemainingSecrets(args: RevealRemainingSecretsArgs) {
        for (const [pId, raw] of Object.entries(args.secrets ?? {})) {
            const playerId = Number(pId);
            const secret = this.ensureSecretCard({ ...raw, visible: true });
            const secretStock = this.secretStocks.get(playerId);
            if (!secretStock) continue;
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
