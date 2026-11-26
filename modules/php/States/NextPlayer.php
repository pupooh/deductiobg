<?php

declare(strict_types=1);

namespace SuaVEStudio\BrainGames\Deductio\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use SuaVEStudio\BrainGames\Deductio\Game;

class NextPlayer extends GameState
{
    public function __construct(
        protected Game $game,
    ) {
        parent::__construct(
            $game,
            id: 90,
            type: StateType::GAME,
            updateGameProgression: true,
        );
    }

    public function onEnteringState(int $activePlayerId): string
    {
        $this->game->globals->set(Game::GLOBAL_PENALTY_REMAINING, 0);
        $this->game->globals->set(Game::GLOBAL_PEEKED_CARD_IDS, []);

        $this->bga->tableStats->inc('turns_number', 1);
        $this->bga->playerStats->inc('turns_number', 1, $activePlayerId);

        $this->game->giveExtraTime($activePlayerId);
        $this->game->activeNextPlayer();

        return PlayerTurn::class;
    }
}
