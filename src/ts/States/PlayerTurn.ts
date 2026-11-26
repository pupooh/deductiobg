import { Game } from "../Game";

/**
 * PlayerTurn (state 10, ACTIVE_PLAYER).
 *
 * On the active player's turn, truthful Clue cards in the row are computed
 * locally from their own Secret Number + the revealed secrets and made
 * clickable (the server re-validates every play — this highlighting is UX
 * only). If no row card is truthful, the "Take All 3 (Horizontal)" action
 * is offered instead. Guessing is available unless this is a penalty turn.
 */
export class PlayerTurn {
    public args: PlayerTurnArgs;

    constructor(private game: Game, private bga: Bga<deductiobgPlayer, deductiobgGamedatas>) {
    }

    onEnteringState(args: PlayerTurnArgs, isCurrentPlayerActive: boolean) {
        this.args = args;
        const penalty = args.penaltyRemaining ?? 0;

        if (isCurrentPlayerActive) {
            if (penalty > 0) {
                this.bga.statusBar.setTitle(
                    _('${you} must play a Clue card (penalty — ${remaining} left)'),
                    { remaining: penalty },
                );
            } else {
                this.bga.statusBar.setTitle(
                    _('${you} must play a truthful Clue card, take all 3, or guess a Secret Number'),
                );
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
                } else {
                    this.game.setRowSelectionMode('none');
                    this.bga.statusBar.addActionButton(
                        _('Take All 3 (Horizontal)'),
                        () => this.game.playAllHorizontal(),
                        { color: 'primary' },
                    );
                }
            });

            if (args.canGuess) {
                this.game.setGuessAllowed(true);
                this.bga.statusBar.addActionButton(
                    _('Guess a Secret Number'),
                    () => this.game.openGuessPicker(),
                    { color: 'secondary' },
                );
            } else {
                this.game.setGuessAllowed(false);
            }
        } else {
            this.bga.statusBar.setTitle(
                penalty > 0
                    ? _('${actplayer} must play a Clue card (penalty — ${remaining} left)')
                    : _('${actplayer} must play a Clue card'),
                { remaining: penalty },
            );
            this.game.setGuessAllowed(false);
        }
    }

    onLeavingState(_args: PlayerTurnArgs, _isCurrentPlayerActive: boolean) {
        // Invalidate any deferred selection apply still waiting on the stocks.
        this.game.nextRowInteractivityToken();
        this.game.setRowSelectionMode('none');
        this.game.setGuessAllowed(false);
        this.game.closeGuessPicker();
    }
}
