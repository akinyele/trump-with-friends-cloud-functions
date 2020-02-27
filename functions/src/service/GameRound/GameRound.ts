import {Card, Rank, Suite} from "../../data/Card";
import {GameRound, GameRoundStates} from "../../data/GameRound";


/**
 *
 * @param plays
 * @param startingCard
 * @param trump
 */
export function getWinner(plays: Map<string, Card>, startingCard: Card, trump: Card): string {

    const players = plays.keys();
    let winner: string = "";
    let winningCard: Card = startingCard;

    for (const player of players) {
        const playerCard = plays.get(player);

        if (playerCard === undefined) continue;
        if (isGreaterCard( winningCard, playerCard, trump)) continue;

        winningCard = playerCard;
        winner = player
    }

    return winner
}

function isSameSuite(card1: Card, card2: Card): boolean {
    return card1.suite === card2.suite;
}

/**
 * @param card1
 * @param card2
 */
function isGreaterRank(card1: Card, card2: Card): boolean {
    const rank1 = isNaN(card1.rank) ? +Rank[card1.rank] : card1.rank;
    const rank2 = isNaN(card2.rank) ? +Rank[card2.rank] : card2.rank;

    return rank1 > rank2;
}

/**
 * Used determine is a card is greater than another.
 *
 * A card is greater when:
 *  1 - they are the same suite and the rank is greater.
 *  2 - they are different ranks and the other card is not a trump. (only when another card is trump can it be greater)
 *
 * @param card1 - card being
 * @param card2
 * @param trumpCard: The cards that acts as the trump for this round.
 * @return returns true if @card1 is greater than @card2
 */
export function isGreaterCard(card1: Card, card2: Card, trumpCard: Card): boolean {
    // check is same suite and find greater
    if (isSameSuite(card1, card2)) return isGreaterRank(card1, card2);
    // check if card2 is trump
    else return !isSameSuite(card2, trumpCard);
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
    if (!trump) {
        console.log("failed to get trump");
        return [];
    }

    const gameRound : GameRound = {
        id: "",
        number: round,
        state: GameRoundStates.BIDDING,
        theTrump: trump,
        userPots: {},
        bids: {},
        players: players,
        pot: {},
        deck: deck,
        previousPots: [],
        numberOfPots: hands.length,
        startingPlayer: players[0]
    };

    return [gameRound, hands]
}
