<?php

declare(strict_types=1);

namespace Bga\Games\deductiobg\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\deductiobg\Game;

class LookAtCards extends GameState
{
    public function __construct(
        protected Game $game,
    ) {
        parent::__construct(
            $game,
            id: 25,
            type: StateType::ACTIVE_PLAYER,
        );
    }

    /**
     * Publicly visible args only include the count, never the peeked numbers.
     *
     * @return array{count: int}
     */
    public function getArgs(): array
    {
        $peekedIds = $this->game->globals->get(Game::GLOBAL_PEEKED_CARD_IDS, []);

        return [
            'count' => count($peekedIds),
        ];
    }

    /**
     * @param int[] $orderedCardIds
     */
    #[PossibleAction]
    public function actReturnPeekedCards(array $orderedCardIds, int $activePlayerId): string
    {
        $expectedIds = $this->game->globals->get(Game::GLOBAL_PEEKED_CARD_IDS, []);
        $orderedCardIds = array_map('intval', $orderedCardIds);

        $sortedExpected = $expectedIds;
        $sortedProvided = $orderedCardIds;
        sort($sortedExpected);
        sort($sortedProvided);

        if ($sortedExpected !== $sortedProvided) {
            throw new UserException('Returned cards do not match the peeked cards');
        }

        $this->game->secretCards->returnPeekedCardsToBottom($orderedCardIds);
        $this->game->globals->set(Game::GLOBAL_PEEKED_CARD_IDS, []);

        $this->bga->notify->all(
            'peekedCardsReturned',
            clienttranslate('${player_name} looked at ${count} Secret Number card(s) and placed them on the bottom of the deck.'),
            [
                'player_id' => $activePlayerId,
                'count' => count($orderedCardIds),
            ]
        );

        return NextPlayer::class;
    }

    public function zombie(int $playerId): string
    {
        $peekedIds = $this->game->globals->get(Game::GLOBAL_PEEKED_CARD_IDS, []);
        return $this->actReturnPeekedCards($peekedIds, $playerId);
    }
}
