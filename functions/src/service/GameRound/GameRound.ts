import {Card, Rank, Suite} from "../../data/Card";
import {GameRound, GameRoundStates} from "../../data/GameRound";


/**
 *
 * @param plays
 * @param trump
 */
export function getWinner(plays: Map<string, Card>, trump: Card): string {
    return ""
}

function isSameSuite(card1: Card, card2: Card): boolean {
    return card1.suite === card2.suite;
}

function isGreaterRank(card1: Card, card2: Card): boolean {
    return card1.rank > card2.rank;
}

/**
 *
 * @param card1
 * @param card2
 * @param trumpCard: The cards that acts as the trump for this round.
 */
export function isGreaterCard(card1: Card, card2: Card, trumpCard: Card): boolean {

    const TRUMP = trumpCard.suite;

    const isBothTrump = card1.suite === TRUMP && card2.suite === TRUMP;
    if (isBothTrump) return isGreaterRank(card1, card2);

    if (isSameSuite(card1, card2)) return isGreaterRank(card1, card2);




    isGreaterRank(card1, card2);

    return false;
}

export function createDeck(): Array<Card> {

    let id = 1;
    const cards = Array<any>();

    for (const suite in Suite) {
        if(!isNaN(Number(suite))) continue; // skip over number literals
        for (const rank in Rank) {
            if (!isNaN(Number(rank))) continue; // skip over number literals.

            const card = {id, suite, rank};
            cards.push(card);
            id++;
        }
    }

    return cards;
}

export function shuffleCards(cards: Array<Card>) : Array<Card>{
    // Fisher-Yates algorithm
    // https://gamedevelopment.tutsplus.com/tutorials/quick-tip-shuffle-cards-or-any-elements-with-the-fisher-yates-shuffle-algorithm--gamedev-6314
    for (let i = cards.length; i < 0; i++) {
        const randomPos = Math.floor(Math.random() * i);
        const temp = cards[i];
        cards[i] = cards[randomPos];
        cards[randomPos] = temp;
    }

    return cards;
}

export function shareCards(players: Array<string>, deck: Array<Object>, round: number): Array<any> {

    const numPlayers = players.length;
    const numCards = deck.length;
    const hands = Array<object>();

    // create empty hands
    for (let p = 0; p < numPlayers; p++) {
        const hand = {
            playerId: players[p],
            cards: []
        };
        hands.push(hand);
    }

    // determine amount to share.
    const maxAmntToShare = (numCards % numPlayers > 0) ? Math.floor(numCards / numPlayers) : (Math.floor(numCards / numPlayers) - 1);
    let numToShare = maxAmntToShare - (round - 1);
    if (numToShare <= 1) numToShare = 2; // amount to share should never be less than 2.

    // issue cards
    for (let i = 0; i < numToShare; i++) {
        for (const hand of hands) {
            // @ts-ignore
            hand.cards.push(deck.pop())
        }
    }
    return [deck, hands]
}

/**
 * Creates a new round in a game.
 * @param players
 */
export async function createRound(players: Array<any>) {
    let hands: Card[];
    let deck = createDeck();
    const round = 1;

    // shuffle the deck
    deck = shuffleCards(deck);

    // share the cards
    [deck, hands] = shareCards(players, deck, round);

    const trump = deck.pop();

    const gameRound : GameRound = {
        id: "",
        number: round,
        state: GameRoundStates.BIDDING,
        theTrump: trump,
        userPots: [],
        bids: Array(),
        players: players,
        pot: {},
        deck: deck,
        previousPots: [],
        startingPlayer: players[0]
    };

    return [gameRound, hands]
}
