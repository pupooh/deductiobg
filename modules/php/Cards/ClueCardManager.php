<?php

declare(strict_types=1);

namespace Bga\Games\DeductioBG\Cards;

use Bga\GameFramework\Components\ItemManager\ItemLocation;
use Bga\GameFramework\Components\ItemManager\ItemManager;
use Bga\GameFramework\Components\ItemManagerFactory;
use Bga\Games\DeductioBG\Material;

/**
 * Manages ClueCard items (35 regular Clue cards + 5/7 Reveal cards) via BGA ItemManager.
 */
class ClueCardManager
{
    public const int ROW_SIZE = 3;

    /** @var ItemManager<ClueCard> */
    private ItemManager $manager;

    public function __construct(ItemManagerFactory $itemManagerFactory)
    {
        $this->manager = $itemManagerFactory->createItemManager(
            ClueCard::class,
            locations: [
                new ItemLocation(
                    CardLocation::DECK,
                    autoReshuffleFrom: CardLocation::DISCARD,
                ),
                new ItemLocation(CardLocation::DISCARD),
                new ItemLocation(CardLocation::BOX),
                new ItemLocation(CardLocation::ROW),
                new ItemLocation(CardLocation::TABLEAU),
            ],
        );
    }

    public function initDb(): void
    {
        $this->manager->initDb();
    }

    public function setupCards(int $playerCount): void
    {
        // Step 3: Create and shuffle the 35 regular Clue cards, then deal 3 face-up to the row.
        $clueItems = [];
        for ($typeId = Material::CLUE_TYPE_MIN; $typeId <= Material::CLUE_TYPE_MAX; $typeId++) {
            $clueItems[] = [
                'location' => CardLocation::DECK,
                'clueTypeId' => $typeId,
                'isReveal' => false,
                'orientation' => ClueCard::ORIENTATION_VERTICAL,
            ];
        }
        $this->manager->createItems($clueItems);
        $this->manager->shuffle(CardLocation::DECK);

        for ($slot = 0; $slot < self::ROW_SIZE; $slot++) {
            $this->manager->pickItem(CardLocation::DECK, [CardLocation::ROW, $slot]);
        }

        // Steps 4–5: Add 5 Reveal cards in 4P, or 7 in 2–3P, and shuffle into Clue deck.
        $revealCount = $playerCount >= 4 ? Material::REVEAL_CARDS_4P : Material::REVEAL_CARDS_STANDARD;
        $revealItems = [];
        for ($i = 0; $i < $revealCount; $i++) {
            $revealItems[] = [
                'location' => CardLocation::DECK,
                'clueTypeId' => Material::REVEAL_CLUE_TYPE_ID,
                'isReveal' => true,
                'orientation' => ClueCard::ORIENTATION_VERTICAL,
            ];
        }
        $this->manager->createItems($revealItems);
        $this->manager->shuffle(CardLocation::DECK);
    }

    public function getCardById(int $cardId): ?ClueCard
    {
        return $this->manager->getItemById($cardId);
    }

    /**
     * @return array<int, ClueCard> Keyed by slot index (0..2)
     */
    public function getRowCards(): array
    {
        $bySlot = [];
        for ($slot = 0; $slot < self::ROW_SIZE; $slot++) {
            $card = $this->manager->getItemsInLocation([CardLocation::ROW, $slot])->first();
            if ($card !== null) {
                $bySlot[$slot] = $card;
            }
        }
        return $bySlot;
    }

    /**
     * @return ClueCard[]
     */
    public function getPlayerTableau(int $playerId): array
    {
        return $this->manager->getItemsInLocation([CardLocation::TABLEAU, $playerId])->values();
    }

    /**
     * @return ClueCard[]
     */
    public function getAllTableaux(): array
    {
        return $this->manager->getItemsInLocation([CardLocation::TABLEAU, null])->values();
    }

    public function playVertical(ClueCard $card, int $playerId): void
    {
        $card->orientation = ClueCard::ORIENTATION_VERTICAL;
        $this->manager->updateItem($card, ['orientation']);
        $this->manager->moveItem($card, [CardLocation::TABLEAU, $playerId]);
    }

    /**
     * @return ClueCard[]
     */
    public function playAllHorizontal(int $playerId): array
    {
        $cards = array_values($this->getRowCards());
        foreach ($cards as $card) {
            $card->orientation = ClueCard::ORIENTATION_HORIZONTAL;
            $this->manager->updateItem($card, ['orientation']);
            $this->manager->moveItem($card, [CardLocation::TABLEAU, $playerId]);
        }
        return $cards;
    }

    /**
     * @return ClueCard[]
     */
    public function discardPlayerTableau(int $playerId): array
    {
        $cards = $this->getPlayerTableau($playerId);
        foreach ($cards as $card) {
            $card->orientation = ClueCard::ORIENTATION_VERTICAL;
            $this->manager->updateItem($card, ['orientation']);
            $this->manager->moveItem($card, CardLocation::DISCARD);
        }
        return $cards;
    }

    /**
     * Discard any horizontally placed +1/-1 Clue cards from all players' tableaux
     * when a new Secret Number card is revealed in the center.
     *
     * @return ClueCard[]
     */
    public function discardHorizontalAdjacentClues(): array
    {
        $discarded = [];
        foreach ($this->getAllTableaux() as $card) {
            if (
                $card->orientation === ClueCard::ORIENTATION_HORIZONTAL
                && !$card->isReveal
                && Material::isAdjacentToRevealedClue($card->clueTypeId)
            ) {
                $card->orientation = ClueCard::ORIENTATION_VERTICAL;
                $this->manager->updateItem($card, ['orientation']);
                $this->manager->moveItem($card, CardLocation::DISCARD);
                $discarded[] = $card;
            }
        }
        return $discarded;
    }

    public function pickTopDeckCardForRow(int $slot): ?ClueCard
    {
        return $this->manager->pickItem(CardLocation::DECK, [CardLocation::ROW, $slot]);
    }

    public function moveToBox(ClueCard $card): void
    {
        $this->manager->moveItem($card, CardLocation::BOX);
    }

    public function getDeckCount(): int
    {
        return $this->manager->countItemsInLocation(CardLocation::DECK);
    }

    public function getDiscardCount(): int
    {
        return $this->manager->countItemsInLocation(CardLocation::DISCARD);
    }
}
