<?php

declare(strict_types=1);

namespace Bga\Games\DeductioBG\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\Games\DeductioBG\Game;

class FreeGuess extends GameState
{
    public function __construct(
        protected Game $game,
    ) {
        parent::__construct(
            $game,
            id: 20,
            type: StateType::ACTIVE_PLAYER,
        );
    }

    public function getArgs(): array
    {
        return [];
    }

    #[PossibleAction]
    public function actFreeGuess(int $targetPlayerId, int $number, int $activePlayerId): string
    {
        return $this->game->resolveGuess($activePlayerId, $targetPlayerId, $number, true);
    }

    #[PossibleAction]
    public function actSkipFreeGuess(int $activePlayerId): string
    {
        $this->bga->notify->all(
            'freeGuessSkipped',
            clienttranslate('${player_name} skips the Free Guess.'),
            [
                'player_id' => $activePlayerId,
            ]
        );

        return NextPlayer::class;
    }

    public function zombie(int $playerId): string
    {
        return $this->actSkipFreeGuess($playerId);
    }
}
