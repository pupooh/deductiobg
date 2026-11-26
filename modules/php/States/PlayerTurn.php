<?php

declare(strict_types=1);

namespace SuaVEStudio\BrainGames\Deductio\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use SuaVEStudio\BrainGames\Deductio\Game;
use SuaVEStudio\BrainGames\Deductio\Material;

class PlayerTurn extends GameState
{
    public function __construct(
        protected Game $game,
    ) {
        parent::__construct(
            $game,
            id: 10,
            type: StateType::ACTIVE_PLAYER,
        );
    }

    /**
     * Publicly visible state args (never expose truthfulClueIds here).
     *
     * @return array{penaltyRemaining: int, canGuess: bool}
     */
    public function getArgs(): array
    {
        $penaltyRemaining = (int) $this->game->globals->get(Game::GLOBAL_PENALTY_REMAINING, 0);

        return [
            'penaltyRemaining' => $penaltyRemaining,
            'canGuess' => $penaltyRemaining === 0,
        ];
    }

    #[PossibleAction]
    public function actPlayClue(int $cardId, int $activePlayerId): string
    {
        $rowCards = $this->game->clueCards->getRowCards();
        $playedCard = null;
        $playedSlot = null;

        foreach ($rowCards as $slot => $card) {
            if ($card->id === $cardId) {
                $playedCard = $card;
                $playedSlot = $slot;
                break;
            }
        }

        if ($playedCard === null) {
            throw new UserException('Selected Clue card is not in the face-up row');
        }

        $secretCard = $this->game->secretCards->getPlayerSecretCard($activePlayerId);
        if ($secretCard === null) {
            throw new UserException('Active player has no Secret Number card');
        }

        $revealedNumbers = $this->game->secretCards->getRevealedNumbers();
        if (!Material::isClueTrueForNumber($playedCard->clueTypeId, $secretCard->number, $revealedNumbers)) {
            throw new UserException('You can only play a Clue card that truthfully describes your Secret Number');
        }

        $this->game->clueCards->playVertical($playedCard, $activePlayerId);
        $this->bga->playerStats->inc('clues_played_vertical', 1, $activePlayerId);

        $def = Material::getClueDefinition($playedCard->clueTypeId);
        $this->bga->notify->all(
            'cluePlayedVertical',
            clienttranslate('${player_name} plays Clue "${clue_label}" vertically.'),
            [
                'player_id' => $activePlayerId,
                'slot' => $playedSlot,
                'card' => $this->game->serializeClueCard($playedCard),
                'clue_label' => $def['label'],
            ]
        );

        $this->game->replenishClueRow();

        $penaltyRemaining = (int) $this->game->globals->get(Game::GLOBAL_PENALTY_REMAINING, 0);
        if ($penaltyRemaining > 0) {
            $this->game->globals->set(Game::GLOBAL_PENALTY_REMAINING, $penaltyRemaining - 1);
            return $penaltyRemaining - 1 > 0 ? PlayerTurn::class : NextPlayer::class;
        }

        // Trigger Clue ability on normal (non-penalty) vertical play
        $ability = Material::getAbility($playedCard->clueTypeId);
        if ($ability === Material::ABILITY_FREE_GUESS) {
            $this->bga->playerStats->inc('abilities_triggered', 1, $activePlayerId);
            return FreeGuess::class;
        }

        if ($ability === Material::ABILITY_LOOK_1 || $ability === Material::ABILITY_LOOK_2) {
            $count = $ability === Material::ABILITY_LOOK_2 ? 2 : 1;
            $peeked = $this->game->secretCards->peekTopCards($count);
            if ($peeked !== []) {
                $this->bga->playerStats->inc('abilities_triggered', 1, $activePlayerId);
                $peekedIds = array_map(static fn($c): int => $c->id, $peeked);
                $this->game->globals->set(Game::GLOBAL_PEEKED_CARD_IDS, $peekedIds);

                $this->bga->notify->player($activePlayerId, 'peekSecretCards', '', [
                    'cards' => array_map($this->game->serializeSecretCard(...), $peeked),
                ]);

                return LookAtCards::class;
            }
        }

        return NextPlayer::class;
    }

    #[PossibleAction]
    public function actPlayAllHorizontal(int $activePlayerId): string
    {
        $rowCards = $this->game->clueCards->getRowCards();
        if ($rowCards === []) {
            throw new UserException('No Clue cards available in the row');
        }

        $secretCard = $this->game->secretCards->getPlayerSecretCard($activePlayerId);
        if ($secretCard === null) {
            throw new UserException('Active player has no Secret Number card');
        }

        $revealedNumbers = $this->game->secretCards->getRevealedNumbers();
        foreach ($rowCards as $card) {
            if (Material::isClueTrueForNumber($card->clueTypeId, $secretCard->number, $revealedNumbers)) {
                throw new UserException('You cannot play all Clue cards horizontally when a truthful Clue is available');
            }
        }

        $playedCards = $this->game->clueCards->playAllHorizontal($activePlayerId);
        $this->bga->playerStats->inc('clues_played_horizontal', 1, $activePlayerId);

        $this->bga->notify->all(
            'cluesPlayedHorizontal',
            clienttranslate('${player_name} has no truthful Clue and takes all ${count} Clue cards horizontally.'),
            [
                'player_id' => $activePlayerId,
                'count' => count($playedCards),
                'cards' => array_map($this->game->serializeClueCard(...), $playedCards),
            ]
        );

        $this->game->replenishClueRow();

        $penaltyRemaining = (int) $this->game->globals->get(Game::GLOBAL_PENALTY_REMAINING, 0);
        if ($penaltyRemaining > 0) {
            $this->game->globals->set(Game::GLOBAL_PENALTY_REMAINING, $penaltyRemaining - 1);
            return $penaltyRemaining - 1 > 0 ? PlayerTurn::class : NextPlayer::class;
        }

        return NextPlayer::class;
    }

    #[PossibleAction]
    public function actGuess(int $targetPlayerId, int $number, int $activePlayerId): string
    {
        $penaltyRemaining = (int) $this->game->globals->get(Game::GLOBAL_PENALTY_REMAINING, 0);
        if ($penaltyRemaining > 0) {
            throw new UserException('You cannot guess during a penalty Clue action');
        }

        return $this->game->resolveGuess($activePlayerId, $targetPlayerId, $number, false);
    }

    public function zombie(int $playerId): string
    {
        $rowCards = $this->game->clueCards->getRowCards();
        if ($rowCards === []) {
            return NextPlayer::class;
        }

        $secretCard = $this->game->secretCards->getPlayerSecretCard($playerId);
        if ($secretCard === null) {
            return NextPlayer::class;
        }

        $revealedNumbers = $this->game->secretCards->getRevealedNumbers();
        $truthfulIds = [];
        foreach ($rowCards as $card) {
            if (Material::isClueTrueForNumber($card->clueTypeId, $secretCard->number, $revealedNumbers)) {
                $truthfulIds[] = $card->id;
            }
        }

        if ($truthfulIds !== []) {
            $choice = $this->getRandomZombieChoice($truthfulIds);
            return $this->actPlayClue($choice, $playerId);
        }

        return $this->actPlayAllHorizontal($playerId);
    }
}
