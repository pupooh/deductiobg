<?php

/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * deductiobg implementation : © <Your name here> <Your email address here>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * Game.php
 *
 * Main game logic for Deductio.
 */

declare(strict_types=1);

namespace Bga\Games\deductiobg;

use Bga\GameFramework\UserException;
use Bga\Games\deductiobg\Cards\CardLocation;
use Bga\Games\deductiobg\Cards\ClueCard;
use Bga\Games\deductiobg\Cards\ClueCardManager;
use Bga\Games\deductiobg\Cards\SecretCard;
use Bga\Games\deductiobg\Cards\SecretCardManager;
use Bga\Games\deductiobg\States\EndScore;
use Bga\Games\deductiobg\States\NextPlayer;
use Bga\Games\deductiobg\States\PlayerTurn;

class Game extends \Bga\GameFramework\Table
{
    public const string GLOBAL_PENALTY_REMAINING = 'penaltyRemaining';
    public const string GLOBAL_PEEKED_CARD_IDS = 'peekedCardIds';

    public SecretCardManager $secretCards;
    public ClueCardManager $clueCards;

    public function __construct()
    {
        parent::__construct();

        $this->secretCards = new SecretCardManager($this->bga->itemManagerFactory);
        $this->clueCards = new ClueCardManager($this->bga->itemManagerFactory);

        $this->bga->notify->addDecorator(function (string $message, array $args): array {
            if (isset($args['player_id']) && !isset($args['player_name']) && str_contains($message, '${player_name}')) {
                $args['player_name'] = $this->getPlayerNameById((int) $args['player_id']);
            }
            return $args;
        });
    }

    public function getGameProgression(): int
    {
        $players = $this->loadPlayersBasicInfos();
        $playerCount = count($players);
        if ($playerCount === 0) {
            return 0;
        }

        $winningCount = Material::getWinningSecretCount($playerCount);
        $maxScore = 0;
        foreach (array_keys($players) as $playerId) {
            $maxScore = max($maxScore, $this->bga->playerScore->get((int) $playerId));
        }

        return (int) min(100, floor(($maxScore * 100) / $winningCount));
    }

    public function upgradeTableDb($from_version): void
    {
        // No schema migrations needed for initial release.
    }

    protected function getAllDatas(int $currentPlayerId): array
    {
        $result = [];

        $players = $this->getCollectionFromDb(
            'SELECT `player_id` AS `id`, `player_score` AS `score` FROM `player`'
        );

        foreach ($players as $playerId => &$playerData) {
            $pid = (int) $playerId;
            $playerData['guessedSecrets'] = array_map(
                $this->serializeSecretCard(...),
                $this->secretCards->getGuessedCards($pid)
            );
            $playerData['tableau'] = array_map(
                $this->serializeClueCard(...),
                $this->clueCards->getPlayerTableau($pid)
            );
        }
        unset($playerData);

        $result['players'] = $players;
        $result['winningSecretCount'] = Material::getWinningSecretCount(count($players));

        // Hidden information: only send the current player's own Secret Number card.
        $mySecret = isset($players[$currentPlayerId])
            ? $this->secretCards->getPlayerSecretCard($currentPlayerId)
            : null;
        $result['mySecretCard'] = $mySecret !== null ? $this->serializeSecretCard($mySecret) : null;

        $result['revealedSecrets'] = array_map(
            $this->serializeSecretCard(...),
            $this->secretCards->getRevealedCards()
        );

        $clueRow = [];
        foreach ($this->clueCards->getRowCards() as $slot => $card) {
            $clueRow[$slot] = $this->serializeClueCard($card);
        }
        $result['clueRow'] = $clueRow;

        $result['secretDeckCount'] = $this->secretCards->getDeckCount();
        $result['clueDeckCount'] = $this->clueCards->getDeckCount();
        $result['clueDiscardCount'] = $this->clueCards->getDiscardCount();

        // Only expose peeked cards to the active player while in LookAtCards (state 25).
        if (
            $this->gamestate->getCurrentMainStateId() === 25
            && $currentPlayerId === (int) $this->getActivePlayerId()
        ) {
            $peekedIds = $this->globals->get(self::GLOBAL_PEEKED_CARD_IDS, []);
            $result['peekedCards'] = $peekedIds !== []
                ? array_map($this->serializeSecretCard(...), $this->secretCards->getCardsByIds($peekedIds))
                : [];
        }

        return $result;
    }

    protected function setupNewGame($players, $options = [])
    {
        $gameinfos = $this->getGameinfos();
        $defaultColors = $gameinfos['player_colors'];
        $queryValues = [];

        foreach ($players as $playerId => $player) {
            $queryValues[] = vsprintf("(%s, '%s', '%s')", [
                $playerId,
                array_shift($defaultColors),
                addslashes($player['player_name']),
            ]);
        }

        static::DbQuery(
            sprintf(
                'INSERT INTO `player` (`player_id`, `player_color`, `player_name`) VALUES %s',
                implode(',', $queryValues)
            )
        );

        $this->reattributeColorsBasedOnPreferences($players, $gameinfos['player_colors']);
        $this->reloadPlayersBasicInfos();

        // Initialize ItemManager tables
        $this->secretCards->initDb();
        $this->clueCards->initDb();

        // Setup Secret Number cards: 1 per player face down, then 3 face up in center
        $this->secretCards->setupCards();
        foreach (array_keys($players) as $playerId) {
            $this->secretCards->dealToPlayer((int) $playerId);
        }
        for ($i = 0; $i < 3; $i++) {
            $this->secretCards->revealTopCard();
        }

        // Setup Clue cards: 3 face up in row, then shuffle in 5 or 7 Reveal cards
        $this->clueCards->setupCards(count($players));

        // Initialize game globals
        $this->globals->set(self::GLOBAL_PENALTY_REMAINING, 0);
        $this->globals->set(self::GLOBAL_PEEKED_CARD_IDS, []);

        // Initialize statistics
        $this->bga->tableStats->init(['turns_number', 'reveal_cards_triggered'], 0);
        $this->bga->playerStats->init([
            'turns_number',
            'clues_played_vertical',
            'clues_played_horizontal',
            'abilities_triggered',
            'guesses_correct',
            'guesses_incorrect',
            'times_guessed',
        ], 0);

        $this->activeNextPlayer();

        return PlayerTurn::class;
    }

    /**
     * Replenish empty slots in the 3-card Clue row, resolving any drawn "Reveal a Secret Number" cards.
     */
    public function replenishClueRow(): void
    {
        for ($slot = 0; $slot < ClueCardManager::ROW_SIZE; $slot++) {
            $rowCards = $this->clueCards->getRowCards();
            while (!isset($rowCards[$slot])) {
                $card = $this->clueCards->pickTopDeckCardForRow($slot);
                if ($card === null) {
                    return;
                }

                if ($card->isReveal) {
                    $this->clueCards->moveToBox($card);
                    $this->bga->tableStats->inc('reveal_cards_triggered', 1);

                    $revealedSecret = $this->secretCards->revealTopCard();
                    $discardedAdjacent = $this->clueCards->discardHorizontalAdjacentClues();

                    $this->bga->notify->all(
                        'revealCardTriggered',
                        $revealedSecret !== null
                            ? clienttranslate('A "Reveal a Secret Number" card was drawn! ${number} cannot be any player\'s Secret Number.')
                            : clienttranslate('A "Reveal a Secret Number" card was drawn, but the Secret Number deck is empty.'),
                        [
                            'revealCard' => $this->serializeClueCard($card),
                            'revealedSecret' => $revealedSecret !== null ? $this->serializeSecretCard($revealedSecret) : null,
                            'number' => $revealedSecret?->number,
                            'discardedAdjacent' => array_map($this->serializeClueCard(...), $discardedAdjacent),
                            'secretDeckCount' => $this->secretCards->getDeckCount(),
                            'clueDeckCount' => $this->clueCards->getDeckCount(),
                            'clueDiscardCount' => $this->clueCards->getDiscardCount(),
                        ]
                    );

                    $rowCards = $this->clueCards->getRowCards();
                    continue;
                }

                $this->bga->notify->all('clueRowReplenished', '', [
                    'slot' => $slot,
                    'card' => $this->serializeClueCard($card),
                    'clueDeckCount' => $this->clueCards->getDeckCount(),
                    'clueDiscardCount' => $this->clueCards->getDiscardCount(),
                ]);
                break;
            }
        }
    }

    /**
     * Shared guess resolution for both normal Guess and Free Guess ability.
     *
     * @return class-string
     */
    public function resolveGuess(int $activePlayerId, int $targetPlayerId, int $guessedNumber, bool $isFreeGuess): string
    {
        $players = $this->loadPlayersBasicInfos();
        if (!isset($players[$targetPlayerId]) || $targetPlayerId === $activePlayerId) {
            throw new UserException('Invalid target player');
        }
        if ($guessedNumber < Material::SECRET_CARD_MIN || $guessedNumber > Material::SECRET_CARD_MAX) {
            throw new UserException('Secret number must be between 1 and 20');
        }

        $targetSecret = $this->secretCards->getPlayerSecretCard($targetPlayerId);
        if ($targetSecret !== null && $targetSecret->number === $guessedNumber) {
            $this->secretCards->moveToGuessed($targetSecret, $activePlayerId);
            $newScore = $this->bga->playerScore->inc($activePlayerId, 1, null);
            $this->bga->playerStats->inc('guesses_correct', 1, $activePlayerId);
            $this->bga->playerStats->inc('times_guessed', 1, $targetPlayerId);

            $this->bga->notify->all(
                'guessCorrect',
                clienttranslate('${player_name} correctly guessed ${target_name}\'s Secret Number (${number})!'),
                [
                    'player_id' => $activePlayerId,
                    'target_id' => $targetPlayerId,
                    'target_name' => $this->getPlayerNameById($targetPlayerId),
                    'number' => $guessedNumber,
                    'secretCard' => $this->serializeSecretCard($targetSecret),
                    'newScore' => $newScore,
                ]
            );

            if ($newScore >= Material::getWinningSecretCount(count($players))) {
                return EndScore::class;
            }

            $discardedTableau = $this->clueCards->discardPlayerTableau($targetPlayerId);
            $newSecret = $this->secretCards->dealToPlayer($targetPlayerId);

            $this->bga->notify->all('tableauDiscardedForNewSecret', '', [
                'target_id' => $targetPlayerId,
                'discardedCards' => array_map($this->serializeClueCard(...), $discardedTableau),
                'hasNewSecret' => $newSecret !== null,
                'secretDeckCount' => $this->secretCards->getDeckCount(),
                'clueDiscardCount' => $this->clueCards->getDiscardCount(),
            ]);

            if ($newSecret !== null) {
                $this->bga->notify->player(
                    $targetPlayerId,
                    'newSecretCard',
                    clienttranslate('Your new Secret Number is ${number}.'),
                    [
                        'number' => $newSecret->number,
                        'secretCard' => $this->serializeSecretCard($newSecret),
                    ]
                );
            }

            return NextPlayer::class;
        }

        $this->bga->playerStats->inc('guesses_incorrect', 1, $activePlayerId);
        $this->bga->notify->all(
            'guessIncorrect',
            $isFreeGuess
                ? clienttranslate('${player_name} guessed ${number} for ${target_name} (Free Guess) — incorrect, no penalty.')
                : clienttranslate('${player_name} guessed ${number} for ${target_name} — incorrect! Must play 2 Clue cards.'),
            [
                'player_id' => $activePlayerId,
                'target_id' => $targetPlayerId,
                'target_name' => $this->getPlayerNameById($targetPlayerId),
                'number' => $guessedNumber,
                'isFreeGuess' => $isFreeGuess,
            ]
        );

        if ($isFreeGuess) {
            return NextPlayer::class;
        }

        $this->globals->set(self::GLOBAL_PENALTY_REMAINING, 2);
        return PlayerTurn::class;
    }

    /**
     * @return array{id: int, number: int}
     */
    public function serializeSecretCard(SecretCard $card): array
    {
        return [
            'id' => $card->id,
            'number' => $card->number,
        ];
    }

    /**
     * @return array{id: int, clueTypeId: int, isReveal: bool, orientation: string}
     */
    public function serializeClueCard(ClueCard $card): array
    {
        return [
            'id' => $card->id,
            'clueTypeId' => $card->clueTypeId,
            'isReveal' => $card->isReveal,
            'orientation' => $card->orientation,
        ];
    }

    public function debug_goToState(int $state = 10): void
    {
        $this->gamestate->jumpToState($state);
    }
}
