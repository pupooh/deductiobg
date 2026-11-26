import { Game } from "../Game";

/**
 * FreeGuess (state 20, ACTIVE_PLAYER). Entered after playing a Clue card
 * with the Free Guess ability: the active player may guess one Secret
 * Number with no penalty for a wrong guess, or skip the free guess.
 */
export class FreeGuess {
    public args: FreeGuessArgs;

    constructor(private game: Game, private bga: Bga<deductiobgPlayer, deductiobgGamedatas>) {
    }

    onEnteringState(_args: FreeGuessArgs, isCurrentPlayerActive: boolean) {
        if (isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(
                _('${you} may make a Free Guess (no penalty if wrong), or skip it'),
            );
            this.game.setGuessAllowed(true);
            this.bga.statusBar.addActionButton(
                _('Make a Free Guess'),
                () => this.game.openGuessPicker(),
                { color: 'primary' },
            );
            this.bga.statusBar.addActionButton(
                _('Skip Free Guess'),
                () => this.game.skipFreeGuess(),
                { color: 'secondary' },
            );
        } else {
            this.bga.statusBar.setTitle(_('${actplayer} may make a Free Guess'));
            this.game.setGuessAllowed(false);
        }
    }

    onLeavingState(_args: FreeGuessArgs, _isCurrentPlayerActive: boolean) {
        this.game.setGuessAllowed(false);
        this.game.closeGuessPicker();
    }
}
