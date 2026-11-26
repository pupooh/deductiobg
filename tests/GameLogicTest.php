<?php

declare(strict_types=1);

namespace Bga\Games\deductiobg\Tests;

use Bga\GameFramework\UserException;
use PHPUnit\Framework\TestCase;
use Bga\Games\deductiobg\Cards\CardLocation;
use Bga\Games\deductiobg\Cards\ClueCard;
use Bga\Games\deductiobg\Game;
use Bga\Games\deductiobg\Material;
use Bga\Games\deductiobg\States\EndScore;
use Bga\Games\deductiobg\States\FreeGuess;
use Bga\Games\deductiobg\States\LookAtCards;
use Bga\Games\deductiobg\States\NextPlayer;
use Bga\Games\deductiobg\States\PlayerTurn;

final class GameLogicTest extends TestCase
{
    private function createStartedGame(int $playerCount = 2): Game
    {
        $players = [];
        for ($i = 1; $i <= $playerCount; $i++) {
            $players[100 + $i] = ['player_name' => "Player{$i}"];
        }

        $game = new Game();
        $initialState = $game->startTestGame($players);
        $this->assertSame(PlayerTurn::class, $initialState);
        return $game;
    }

    /**
     * Helper to access underlying ClueCardManager's ItemManager via reflection for deterministic edge-case setups.
     */
    private function getInternalManager(object $cardManager): \Bga\GameFramework\Components\ItemManager\ItemManager
    {
        $ref = new \ReflectionProperty($cardManager, 'manager');
        return $ref->getValue($cardManager);
    }

    public function testSetupCountsAndHiddenInformation(): void
    {
        $game2p = $this->createStartedGame(2);
        $this->assertCount(3, $game2p->secretCards->getRevealedCards());
        $this->assertSame(15, $game2p->secretCards->getDeckCount()); // 20 - 2 players - 3 revealed
        $this->assertCount(3, $game2p->clueCards->getRowCards());
        $this->assertSame(39, $game2p->clueCards->getDeckCount()); // 35 - 3 row + 7 reveal

        $game4p = $this->createStartedGame(4);
        $this->assertSame(13, $game4p->secretCards->getDeckCount()); // 20 - 4 players - 3 revealed
        $this->assertSame(37, $game4p->clueCards->getDeckCount()); // 35 - 3 row + 5 reveal

        // Verify getAllDatas hides opponent's secret number
        $method = new \ReflectionMethod($game2p, 'getAllDatas');
        $dataP1 = $method->invoke($game2p, 101);
        $dataP2 = $method->invoke($game2p, 102);

        $this->assertNotNull($dataP1['mySecretCard']);
        $this->assertNotNull($dataP2['mySecretCard']);
        $this->assertNotSame($dataP1['mySecretCard']['number'], $dataP2['mySecretCard']['number']);
        $this->assertArrayNotHasKey('mySecretCard', $dataP1['players'][102]);
        $this->assertNull($method->invoke($game2p, 999)['mySecretCard']); // Spectator
    }

    public function testPlayTruthfulAndUntruthfulClue(): void
    {
        $game = $this->createStartedGame(2);
        $p1 = 101;
        $p1Secret = $game->secretCards->getPlayerSecretCard($p1);
        $p1Secret->number = 19;

        $clueMgr = $this->getInternalManager($game->clueCards);
        $rowCards = $game->clueCards->getRowCards();
        $rowCards[0]->clueTypeId = 20; // >= 6 (true for 19)
        $rowCards[1]->clueTypeId = 23; // <= 13 (false for 19)

        $turn = new PlayerTurn($game);

        // Playing untruthful clue throws
        try {
            $turn->actPlayClue($rowCards[1]->id, $p1);
            $this->fail('Expected UserException for untruthful clue');
        } catch (UserException) {
            // expected
        }

        // Playing truthful clue succeeds
        $next = $turn->actPlayClue($rowCards[0]->id, $p1);
        $this->assertSame(NextPlayer::class, $next);
        $tableau = $game->clueCards->getPlayerTableau($p1);
        $this->assertCount(1, $tableau);
        $this->assertSame(ClueCard::ORIENTATION_VERTICAL, $tableau[0]->orientation);
    }

    public function testAllThreeHorizontalWhenNoneAreTrue(): void
    {
        $game = $this->createStartedGame(2);
        $p1 = 101;
        $game->secretCards->getPlayerSecretCard($p1)->number = 19;

        $rowCards = $game->clueCards->getRowCards();
        $rowCards[0]->clueTypeId = 26; // Even (false for 19, has Free Guess ability)
        $rowCards[1]->clueTypeId = 28; // Single digit (false for 19)
        $rowCards[2]->clueTypeId = 10; // != 9, 19 (false for 19)

        $turn = new PlayerTurn($game);
        $next = $turn->actPlayAllHorizontal($p1);

        // Must NOT trigger Free Guess ability when played horizontally
        $this->assertSame(NextPlayer::class, $next);
        $tableau = $game->clueCards->getPlayerTableau($p1);
        $this->assertCount(3, $tableau);
        foreach ($tableau as $card) {
            $this->assertSame(ClueCard::ORIENTATION_HORIZONTAL, $card->orientation);
        }
        $this->assertCount(3, $game->clueCards->getRowCards());
    }

    public function testAllHorizontalRejectedIfTruthfulClueExists(): void
    {
        $game = $this->createStartedGame(2);
        $p1 = 101;
        $game->secretCards->getPlayerSecretCard($p1)->number = 19;

        $rowCards = $game->clueCards->getRowCards();
        $rowCards[0]->clueTypeId = 27; // Odd (TRUE for 19)
        $rowCards[1]->clueTypeId = 28; // Single digit (false)
        $rowCards[2]->clueTypeId = 10; // != 9, 19 (false)

        $turn = new PlayerTurn($game);
        $this->expectException(UserException::class);
        $turn->actPlayAllHorizontal($p1);
    }

    public function testRevealCardDiscardsHorizontalAdjacentClues(): void
    {
        $game = $this->createStartedGame(2);
        $p1 = 101;
        $p2 = 102;

        // Place a horizontal +1 clue (type 30) and a horizontal >=6 clue (type 20) in P2's tableau,
        // and a vertical -1 clue (type 31) in P1's tableau.
        $clueMgr = $this->getInternalManager($game->clueCards);

        // The 35 regular Clue cards exist exactly once each, and setup deals 3 of them
        // face-up into the row before the Reveal cards are shuffled in — so a needed
        // type may be sitting in the row instead of the deck. Search the row too, and
        // swap a spare deck card into its slot so the row stays at 3 cards.
        // (Previously this only searched the deck, so the test failed with
        // "Attempt to assign property orientation on null" whenever a needed type
        // had been dealt into the row — roughly 1 run in 4.)
        $neededTypes = [30, 20, 31];
        $findClue = static function (int $typeId) use ($clueMgr, $game, $neededTypes): ?ClueCard {
            $deckCards = $clueMgr->getItemsInLocation(CardLocation::DECK)->values();
            foreach ($deckCards as $c) {
                if (!$c->isReveal && $c->clueTypeId === $typeId) {
                    return $c;
                }
            }
            foreach ($game->clueCards->getRowCards() as $slot => $c) {
                if (!$c->isReveal && $c->clueTypeId === $typeId) {
                    foreach ($deckCards as $replacement) {
                        if (!$replacement->isReveal && !in_array($replacement->clueTypeId, $neededTypes, true)) {
                            $clueMgr->moveItem($replacement, [CardLocation::ROW, $slot]);
                            break;
                        }
                    }
                    return $c;
                }
            }
            return null;
        };

        $hAdj = $findClue(30);
        $hOther = $findClue(20);
        $vAdj = $findClue(31);
        $revealCard = null;
        foreach ($clueMgr->getItemsInLocation(CardLocation::DECK)->values() as $c) {
            if ($c->isReveal) {
                $revealCard = $c;
                break;
            }
        }
        $this->assertNotNull($hAdj, 'Type 30 (+1) clue not found in deck or row');
        $this->assertNotNull($hOther, 'Type 20 (>=6) clue not found in deck or row');
        $this->assertNotNull($vAdj, 'Type 31 (-1) clue not found in deck or row');
        $this->assertNotNull($revealCard, 'Reveal card not found in deck');

        $hAdj->orientation = ClueCard::ORIENTATION_HORIZONTAL;
        $clueMgr->moveItem($hAdj, [CardLocation::TABLEAU, $p2]);
        $hOther->orientation = ClueCard::ORIENTATION_HORIZONTAL;
        $clueMgr->moveItem($hOther, [CardLocation::TABLEAU, $p2]);
        $vAdj->orientation = ClueCard::ORIENTATION_VERTICAL;
        $clueMgr->moveItem($vAdj, [CardLocation::TABLEAU, $p1]);

        // Put a non-reveal card right below a Reveal card on top of the Clue deck, and empty slot 0 in row
        // (re-fetch deck and row: the swaps above may have moved cards between them)
        $nonRevealForSlot = null;
        foreach ($clueMgr->getItemsInLocation(CardLocation::DECK)->values() as $c) {
            if (!$c->isReveal && $c !== $hAdj && $c !== $hOther && $c !== $vAdj) {
                $nonRevealForSlot = $c;
                break;
            }
        }
        $this->assertNotNull($nonRevealForSlot, 'No spare non-reveal card in deck');
        $rowCards = $game->clueCards->getRowCards();
        $this->assertArrayHasKey(0, $rowCards, 'Row slot 0 is empty');
        $clueMgr->moveItem($rowCards[0], CardLocation::DISCARD);
        $maxOrder = $clueMgr->getMaxOrderInLocation(CardLocation::DECK);
        $clueMgr->moveItem($nonRevealForSlot, CardLocation::DECK, $maxOrder + 5);
        $clueMgr->moveItem($revealCard, CardLocation::DECK, $maxOrder + 10);

        $beforeRevealedCount = count($game->secretCards->getRevealedCards());
        $game->replenishClueRow();

        // Reveal card moved to BOX, 1 new Secret revealed, slot 0 filled with a non-reveal Clue
        $this->assertSame(CardLocation::BOX, $revealCard->location);
        $this->assertCount($beforeRevealedCount + 1, $game->secretCards->getRevealedCards());
        $this->assertCount(3, $game->clueCards->getRowCards());
        $this->assertFalse($game->clueCards->getRowCards()[0]->isReveal);

        // Horizontal +1/-1 card was discarded; horizontal >=6 and vertical -1 stayed!
        $this->assertSame(CardLocation::DISCARD, $hAdj->location);
        $this->assertSame([CardLocation::TABLEAU, $p2], $hOther->location);
        $this->assertSame([CardLocation::TABLEAU, $p1], $vAdj->location);
    }

    public function testIncorrectGuessPenaltySuppressesAbilities(): void
    {
        $game = $this->createStartedGame(2);
        $p1 = 101;
        $p2 = 102;
        $game->secretCards->getPlayerSecretCard($p1)->number = 18;
        $game->secretCards->getPlayerSecretCard($p2)->number = 7;

        $turn = new PlayerTurn($game);

        // Wrong normal guess -> penaltyRemaining = 2, stays in PlayerTurn
        $next = $turn->actGuess($p2, 5, $p1);
        $this->assertSame(PlayerTurn::class, $next);
        $this->assertSame(2, $turn->getArgs()['penaltyRemaining']);
        $this->assertFalse($turn->getArgs()['canGuess']);

        // Guessing during penalty throws
        try {
            $turn->actGuess($p2, 7, $p1);
            $this->fail('Expected UserException when guessing during penalty');
        } catch (UserException) {
            // expected
        }

        // Penalty action 1: play Even (Free Guess ability) -> ability MUST NOT trigger!
        $row = $game->clueCards->getRowCards();
        $row[0]->clueTypeId = 26; // Even (true for 18) + Free Guess
        $next = $turn->actPlayClue($row[0]->id, $p1);
        $this->assertSame(PlayerTurn::class, $next);
        $this->assertSame(1, $turn->getArgs()['penaltyRemaining']);

        // Penalty action 2: play Double Digit (Free Guess ability) -> ability suppressed, advances to NextPlayer!
        $row = $game->clueCards->getRowCards();
        $row[0]->clueTypeId = 29; // Double digit (true for 18) + Free Guess
        $next = $turn->actPlayClue($row[0]->id, $p1);
        $this->assertSame(NextPlayer::class, $next);
        $this->assertSame(0, $turn->getArgs()['penaltyRemaining']);
    }

    public function testFreeGuessAbilityWrongGuessHasNoPenalty(): void
    {
        $game = $this->createStartedGame(2);
        $p1 = 101;
        $p2 = 102;
        $game->secretCards->getPlayerSecretCard($p1)->number = 18;
        $game->secretCards->getPlayerSecretCard($p2)->number = 7;

        $row = $game->clueCards->getRowCards();
        $row[0]->clueTypeId = 26; // Even + Free Guess

        $turn = new PlayerTurn($game);
        $next = $turn->actPlayClue($row[0]->id, $p1);
        $this->assertSame(FreeGuess::class, $next);

        $freeGuess = new FreeGuess($game);
        $after = $freeGuess->actFreeGuess($p2, 12, $p1); // Wrong
        $this->assertSame(NextPlayer::class, $after);
        $this->assertSame(0, $game->globals->get(Game::GLOBAL_PENALTY_REMAINING));
    }

    public function testLookAt2CardsOrdersAtBottomOfDeck(): void
    {
        $game = $this->createStartedGame(2);
        $p1 = 101;
        $game->secretCards->getPlayerSecretCard($p1)->number = 3;

        $row = $game->clueCards->getRowCards();
        $row[0]->clueTypeId = 32; // = 1-5 + Look at 2 Cards

        $turn = new PlayerTurn($game);
        $next = $turn->actPlayClue($row[0]->id, $p1);
        $this->assertSame(LookAtCards::class, $next);

        $lookState = new LookAtCards($game);
        // Public args must only expose count, not numbers
        $this->assertSame(['count' => 2], $lookState->getArgs());

        // Take the peeked cards from what the server actually stored: peeking
        // the deck before the play is not stable, because replenishing the Clue
        // row can draw a Reveal card and pop the top Secret card off the deck
        // before the Look ability peeks — so a pre-play snapshot often no
        // longer matches the peeked cards ("Returned cards do not match the
        // peeked cards", roughly 1 run in 5).
        $peekedIds = $game->globals->get(Game::GLOBAL_PEEKED_CARD_IDS, []);
        $this->assertCount(2, $peekedIds);

        // Return in reversed order
        $reversedIds = array_reverse($peekedIds);
        $after = $lookState->actReturnPeekedCards($reversedIds, $p1);
        $this->assertSame(NextPlayer::class, $after);

        // Verify those 2 cards are now at the bottom (lowest order values) of the Secret deck
        $secretMgr = $this->getInternalManager($game->secretCards);
        $bottom2 = $secretMgr->getItemsInLocation(CardLocation::DECK, reversed: false, limit: 2)->values();
        $this->assertSame($reversedIds[0], $bottom2[0]->id);
        $this->assertSame($reversedIds[1], $bottom2[1]->id);
    }

    public function testWinThresholds2PVs3P(): void
    {
        // 2P requires 3 correct guesses
        $game2p = $this->createStartedGame(2);
        $turn2p = new PlayerTurn($game2p);

        for ($g = 1; $g <= 2; $g++) {
            $p2Secret = $game2p->secretCards->getPlayerSecretCard(102)->number;
            $res = $turn2p->actGuess(102, $p2Secret, 101);
            $this->assertSame(NextPlayer::class, $res);
            $this->assertSame($g, $game2p->bga->playerScore->get(101));
        }

        $p2Secret = $game2p->secretCards->getPlayerSecretCard(102)->number;
        $winRes = $turn2p->actGuess(102, $p2Secret, 101);
        $this->assertSame(EndScore::class, $winRes);
        $this->assertSame(3, $game2p->bga->playerScore->get(101));

        // 3P requires 2 correct guesses
        $game3p = $this->createStartedGame(3);
        $turn3p = new PlayerTurn($game3p);

        $p2Secret = $game3p->secretCards->getPlayerSecretCard(102)->number;
        $this->assertSame(NextPlayer::class, $turn3p->actGuess(102, $p2Secret, 101));

        $p3Secret = $game3p->secretCards->getPlayerSecretCard(103)->number;
        $this->assertSame(EndScore::class, $turn3p->actGuess(103, $p3Secret, 101));

        // EndScore reveals remaining secrets
        $endScore = new EndScore($game3p);
        $this->assertSame(99, $endScore->onEnteringState());
    }

    public function testZombieMoves(): void
    {
        $game = $this->createStartedGame(2);
        $turn = new PlayerTurn($game);
        $res = $turn->zombie(101);
        $this->assertContains($res, [NextPlayer::class, FreeGuess::class, LookAtCards::class]);
    }
}
