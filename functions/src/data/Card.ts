export interface Card {
    id: number,
    rank: Rank,
    suite: Suite
}

// suits: ['♥', '♦', '♠', '♣'],
// ranks: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],

export enum Suite {
    'HEART' = 20,
    'DIAMOND',
    'SPADE',
    'CLUB'
}

export enum Rank {
    "TWO" = 1,
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "J",
    "Q",
    "K",
    "A"
}