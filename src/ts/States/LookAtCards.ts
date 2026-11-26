import { Game } from "../Game";

/**
 * LookAtCards (state 25, ACTIVE_PLAYER). Entered after playing a Clue card
 * with the Look at 1/2 Cards ability. The peeked Secret Number cards come
 * from the private peekSecretCards notification (or from getAllDatas on an
 * F5 refresh) and are shown in a modal; the player may swap the order of
 * 2 cards before putting them on the bottom of the deck.
 */
export class LookAtCards {
    public args: LookAtCardsArgs;

    constructor(private game: Game, private bga: Bga<deductiobgPlayer, deductiobgGamedatas>) {
    }

    onEnteringState(args: LookAtCardsArgs, isCurrentPlayerActive: boolean) {
        this.args = args;
        if (isCurrentPlayerActive) {
            const count = args.count ?? 0;
            this.bga.statusBar.setTitle(
                count === 1
                    ? _('${you} must look at 1 Secret Number card and put it on the bottom of the deck')
                    : _('${you} must look at ${count} Secret Number cards and put them on the bottom of the deck'),
                { count },
            );
            this.game.openPeekModal();
        } else {
            this.bga.statusBar.setTitle(_('${actplayer} is looking at Secret Number cards'));
        }
    }

    onLeavingState(_args: LookAtCardsArgs, _isCurrentPlayerActive: boolean) {
        this.game.closePeekModal();
    }
}
