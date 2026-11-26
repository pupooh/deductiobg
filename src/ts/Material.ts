/**
 * Client-side mirror of the 35 Clue card definitions in modules/php/Material.php.
 * Used only for UX: highlighting truthful Clue cards in the row and labelling
 * abilities. The server validates every play, so a mistake here can never
 * let an illegal move through — it can only mis-highlight.
 */
export type ClueAbility = 'free_guess' | 'look_1' | 'look_2' | null;
export type ClueCategory =
    | 'not_in_set'
    | 'gte'
    | 'lte'
    | 'range'
    | 'parity'
    | 'digits'
    | 'offset_from_revealed';

export interface ClueDefinition {
    category: ClueCategory;
    label: string;
    ability: ClueAbility;
    values?: number[];
    min?: number;
    max?: number;
    parity?: 'even' | 'odd';
    digits?: 'single' | 'double';
    offset?: number;
}

export const CLUE_DEFINITIONS: { [clueTypeId: number]: ClueDefinition } = {
    // 1..10: Double-number exclusions
    1: { category: 'not_in_set', label: '≠ 10, 20', ability: null, values: [10, 20] },
    2: { category: 'not_in_set', label: '≠ 1, 11', ability: null, values: [1, 11] },
    3: { category: 'not_in_set', label: '≠ 2, 12', ability: null, values: [2, 12] },
    4: { category: 'not_in_set', label: '≠ 3, 13', ability: null, values: [3, 13] },
    5: { category: 'not_in_set', label: '≠ 4, 14', ability: null, values: [4, 14] },
    6: { category: 'not_in_set', label: '≠ 5, 15', ability: null, values: [5, 15] },
    7: { category: 'not_in_set', label: '≠ 6, 16', ability: null, values: [6, 16] },
    8: { category: 'not_in_set', label: '≠ 7, 17', ability: null, values: [7, 17] },
    9: { category: 'not_in_set', label: '≠ 8, 18', ability: null, values: [8, 18] },
    10: { category: 'not_in_set', label: '≠ 9, 19', ability: null, values: [9, 19] },

    // 11..14: 5-number exclusions
    11: { category: 'not_in_set', label: '≠ 1, 6, 9, 14, 17', ability: null, values: [1, 6, 9, 14, 17] },
    12: { category: 'not_in_set', label: '≠ 2, 5, 10, 13, 18', ability: null, values: [2, 5, 10, 13, 18] },
    13: { category: 'not_in_set', label: '≠ 3, 8, 11, 16, 19', ability: null, values: [3, 8, 11, 16, 19] },
    14: { category: 'not_in_set', label: '≠ 4, 7, 12, 15, 20', ability: null, values: [4, 7, 12, 15, 20] },

    // 15..19: Range exclusions
    15: { category: 'not_in_set', label: '≠ 1–4', ability: null, values: [1, 2, 3, 4] },
    16: { category: 'not_in_set', label: '≠ 5–8', ability: null, values: [5, 6, 7, 8] },
    17: { category: 'not_in_set', label: '≠ 9–12', ability: null, values: [9, 10, 11, 12] },
    18: { category: 'not_in_set', label: '≠ 13–16', ability: null, values: [13, 14, 15, 16] },
    19: { category: 'not_in_set', label: '≠ 17–20', ability: null, values: [17, 18, 19, 20] },

    // 20..22: Lower bounds
    20: { category: 'gte', label: '≥ 6', ability: null, min: 6 },
    21: { category: 'gte', label: '≥ 7', ability: null, min: 7 },
    22: { category: 'gte', label: '≥ 8', ability: null, min: 8 },

    // 23..25: Upper bounds
    23: { category: 'lte', label: '≤ 13', ability: null, max: 13 },
    24: { category: 'lte', label: '≤ 14', ability: null, max: 14 },
    25: { category: 'lte', label: '≤ 15', ability: null, max: 15 },

    // 26..29: Parity / digit count + Free Guess
    26: { category: 'parity', label: 'Even (2, 4, 6...)', ability: 'free_guess', parity: 'even' },
    27: { category: 'parity', label: 'Odd (1, 3, 5...)', ability: 'free_guess', parity: 'odd' },
    28: { category: 'digits', label: 'Single digit (1–9)', ability: 'free_guess', digits: 'single' },
    29: { category: 'digits', label: 'Double digit (10–20)', ability: 'free_guess', digits: 'double' },

    // 30..31: Adjacent to face-up Secret Number + Look at 1 Card
    30: { category: 'offset_from_revealed', label: '+1 from face-up Secret Number', ability: 'look_1', offset: 1 },
    31: { category: 'offset_from_revealed', label: '-1 from face-up Secret Number', ability: 'look_1', offset: -1 },

    // 32..35: Range + Look at 2 Cards
    32: { category: 'range', label: '= 1–5', ability: 'look_2', min: 1, max: 5 },
    33: { category: 'range', label: '= 6–10', ability: 'look_2', min: 6, max: 10 },
    34: { category: 'range', label: '= 11–15', ability: 'look_2', min: 11, max: 15 },
    35: { category: 'range', label: '= 16–20', ability: 'look_2', min: 16, max: 20 },
};

export function getClueDefinition(clueTypeId: number): ClueDefinition | undefined {
    return CLUE_DEFINITIONS[clueTypeId];
}

export function getClueAbility(clueTypeId: number): ClueAbility {
    return CLUE_DEFINITIONS[clueTypeId]?.ability ?? null;
}

/**
 * Mirror of Material::isClueTrueForNumber. `faceUpSecrets` are the numbers
 * on face-up Secret Number cards in the center of the table.
 */
export function isClueTrueForNumber(clueTypeId: number, secretNumber: number, faceUpSecrets: number[]): boolean {
    const def = CLUE_DEFINITIONS[clueTypeId];
    if (!def) return false;

    switch (def.category) {
        case 'not_in_set':
            return !(def.values ?? []).includes(secretNumber);
        case 'gte':
            return secretNumber >= (def.min ?? 0);
        case 'lte':
            return secretNumber <= (def.max ?? 0);
        case 'range':
            return secretNumber >= (def.min ?? 0) && secretNumber <= (def.max ?? 0);
        case 'parity':
            return (secretNumber % 2 === 0) === (def.parity === 'even');
        case 'digits':
            return (secretNumber >= 10) === (def.digits === 'double');
        case 'offset_from_revealed':
            return faceUpSecrets.includes(secretNumber - (def.offset ?? 0));
        default:
            return false;
    }
}
