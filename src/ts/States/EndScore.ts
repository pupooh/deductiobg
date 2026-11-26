import { Game } from "../Game";

/**
 * EndScore (state 98, GAME). The remaining Secret Numbers are revealed via
 * the revealRemainingSecrets notification; this state only sets the title.
 */
export class EndScore {
    public args: Record<string, never> = {};

    constructor(private game: Game, private bga: Bga<deductiobgPlayer, deductiobgGamedatas>) {
    }

    onEnteringState(_args: Record<string, never>, _isCurrentPlayerActive: boolean) {
        this.bga.statusBar.setTitle(_('The game is over — the remaining Secret Numbers are revealed'));
    }
}
