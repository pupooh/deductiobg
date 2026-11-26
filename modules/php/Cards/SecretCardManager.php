<?php

declare(strict_types=1);

namespace Bga\Games\DeductioBG\Cards;

use Bga\GameFramework\Components\ItemManager\ItemLocation;
use Bga\GameFramework\Components\ItemManager\ItemManager;
use Bga\GameFramework\Components\ItemManagerFactory;
use Bga\Games\DeductioBG\Material;

/**
 * Manages SecretCard items (1..20) via BGA ItemManager.
 */
class SecretCardManager
{
    /** @var ItemManager<SecretCard> */
    private ItemManager $manager;

    public function __construct(ItemManagerFactory $itemManagerFactory)
    {
        $this->manager = $itemManagerFactory->createItemManager(
            SecretCard::class,
            locations: [
                new ItemLocation(CardLocation::DECK),
                new ItemLocation(CardLocation::REVEALED),
                new ItemLocation(CardLocation::HAND),
                new ItemLocation(CardLocation::GUESSED),
            ],
        );
    }

    public function initDb(): void
    {
        $this->manager->initDb();
    }

    public function setupCards(): void
    {
        $items = [];
        for ($n = Material::SECRET_CARD_MIN; $n <= Material::SECRET_CARD_MAX; $n++) {
            $items[] = [
                'location' => CardLocation::DECK,
                'number' => $n,
            ];
        }
        $this->manager->createItems($items);
        $this->manager->shuffle(CardLocation::DECK);
    }

    public function dealToPlayer(int $playerId): ?SecretCard
    {
        return $this->manager->pickItem(CardLocation::DECK, [CardLocation::HAND, $playerId]);
    }

    public function revealTopCard(): ?SecretCard
    {
        return $this->manager->pickItem(CardLocation::DECK, CardLocation::REVEALED);
    }

    public function getPlayerSecretCard(int $playerId): ?SecretCard
    {
        return $this->manager->getItemsInLocation([CardLocation::HAND, $playerId])->first();
    }

    /**
     * @return SecretCard[]
     */
    public function getRevealedCards(): array
    {
        return $this->manager->getItemsInLocation(CardLocation::REVEALED)->values();
    }

    /**
     * @return int[]
     */
    public function getRevealedNumbers(): array
    {
        return array_map(
            static fn(SecretCard $card): int => $card->number,
            $this->getRevealedCards()
        );
    }

    /**
     * @return SecretCard[]
     */
    public function getGuessedCards(int $playerId): array
    {
        return $this->manager->getItemsInLocation([CardLocation::GUESSED, $playerId])->values();
    }

    public function moveToGuessed(SecretCard $card, int $playerId): void
    {
        $this->manager->moveItem($card, [CardLocation::GUESSED, $playerId]);
    }

    /**
     * @return SecretCard[]
     */
    public function peekTopCards(int $count): array
    {
        return $this->manager->getItemsOnTop($count, CardLocation::DECK)->values();
    }

    /**
     * Place peeked cards at the bottom of the Secret Number deck in the given order.
     *
     * @param int[] $orderedCardIds
     */
    public function returnPeekedCardsToBottom(array $orderedCardIds): void
    {
        // Shift existing deck items up so bottom slots remain 0..count-1
        $deckCards = $this->manager->getItemsInLocation(CardLocation::DECK)->values();
        $offset = count($orderedCardIds);
        foreach ($deckCards as $deckCard) {
            if (!in_array($deckCard->id, $orderedCardIds, true)) {
                $this->manager->setItemOrder($deckCard, $deckCard->order + $offset);
            }
        }
        foreach (array_values($orderedCardIds) as $index => $cardId) {
            $this->manager->moveItem($cardId, CardLocation::DECK, $index);
        }
    }

    /**
     * @param int[] $ids
     * @return SecretCard[]
     */
    public function getCardsByIds(array $ids): array
    {
        return $this->manager->getItemsByIds($ids)->values();
    }

    public function getDeckCount(): int
    {
        return $this->manager->countItemsInLocation(CardLocation::DECK);
    }
}
