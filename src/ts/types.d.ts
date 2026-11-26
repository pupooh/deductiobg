/**
 * Serialized card shapes sent by the server (see Game::serializeSecretCard /
 * serializeClueCard in modules/php/Game.php).
 */
interface SecretCardData {
    id: number;
    number: number;
    /** True when the front side may be shown to the viewing player. */
    visible?: boolean;
}

interface ClueCardData {
    id: number;
    clueTypeId: number;
    isReveal: boolean;
    orientation: 'vertical' | 'horizontal';
    /** Row slot (0..2) while the card is in the face-up Clue row. */
    slot?: number;
    /** True for the face-down placeholder used for a non-empty discard pile after an F5 refresh. */
    placeholder?: boolean;
}

interface deductiobgPlayer extends Player {
    guessedSecrets: SecretCardData[];
    tableau: ClueCardData[];
}

interface deductiobgGamedatas extends Gamedatas<deductiobgPlayer> {
    winningSecretCount: number;
    /** The viewing player's own Secret Number card, or null for spectators. */
    mySecretCard: SecretCardData | null;
    revealedSecrets: SecretCardData[];
    /** Clue row keyed by slot (0..2). */
    clueRow: { [slot: number]: ClueCardData };
    secretDeckCount: number;
    clueDeckCount: number;
    clueDiscardCount: number;
    /** Only present while the active player is in LookAtCards (state 25). */
    peekedCards?: SecretCardData[];
}

/*
 * Describe here the types for your state args
 */
interface PlayerTurnArgs {
    penaltyRemaining: number;
    canGuess: boolean;
}

interface FreeGuessArgs {
    // No args: the free guess is always available, skipping is always allowed.
}

interface LookAtCardsArgs {
    count: number;
}

/*
 * Describe here the types for your notif args
 */
interface CluePlayedVerticalArgs {
    player_id: number;
    slot: number;
    card: ClueCardData;
    clue_label: string;
}

interface CluesPlayedHorizontalArgs {
    player_id: number;
    count: number;
    cards: ClueCardData[];
}

interface ClueRowReplenishedArgs {
    slot: number;
    card: ClueCardData;
    clueDeckCount: number;
    clueDiscardCount: number;
}

interface RevealCardTriggeredArgs {
    revealCard: ClueCardData;
    revealedSecret: SecretCardData | null;
    number: number | null;
    discardedAdjacent: ClueCardData[];
    secretDeckCount: number;
    clueDeckCount: number;
    clueDiscardCount: number;
}

interface GuessCorrectArgs {
    player_id: number;
    target_id: number;
    target_name: string;
    number: number;
    secretCard: SecretCardData;
    newScore: number;
}

interface GuessIncorrectArgs {
    player_id: number;
    target_id: number;
    target_name: string;
    number: number;
    isFreeGuess: boolean;
}

interface TableauDiscardedForNewSecretArgs {
    target_id: number;
    discardedCards: ClueCardData[];
    hasNewSecret: boolean;
    secretDeckCount: number;
    clueDiscardCount: number;
}

interface NewSecretCardArgs {
    number: number;
    secretCard: SecretCardData;
}

interface PeekSecretCardsArgs {
    cards: SecretCardData[];
}

interface FreeGuessSkippedArgs {
    player_id: number;
}

interface PeekedCardsReturnedArgs {
    player_id: number;
    count: number;
}

interface RevealRemainingSecretsArgs {
    secrets: { [playerId: number]: SecretCardData };
}
