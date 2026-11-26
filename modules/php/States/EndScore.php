<?php

declare(strict_types=1);

namespace Bga\Games\DeductioBG\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\DeductioBG\Game;

const ST_END_GAME = 99;

class EndScore extends GameState
{
    public function __construct(
        protected Game $game,
    ) {
        parent::__construct(
            $game,
            id: 98,
            type: StateType::GAME,
        );
    }

    public function onEnteringState(): int
    {
        $players = $this->game->loadPlayersBasicInfos();
        $revealed = [];

        foreach (array_keys($players) as $playerId) {
            $pid = (int) $playerId;
            $card = $this->game->secretCards->getPlayerSecretCard($pid);
            if ($card !== null) {
                $revealed[$pid] = $this->game->serializeSecretCard($card);
            }
        }

        if ($revealed !== []) {
            $this->bga->notify->all(
                'revealRemainingSecrets',
                clienttranslate('The game has ended! Remaining Secret Numbers are revealed.'),
                [
                    'secrets' => $revealed,
                ]
            );
        }

        return ST_END_GAME;
    }
}
