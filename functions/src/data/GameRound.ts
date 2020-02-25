/**
 *
 **/
export interface GameRound {
    id: string,
    number: number,
    state: GameRoundStates,
    theTrump: any,
    deck: Array<any>,
    bids: object,
    pot: object,
    userPots: object
    previousPots: Array<object>,
    players: Array<string>,
    startingPlayer: string
}


export enum GameRoundStates {
    /* Round has just started and the players are setting bids. */
    BIDDING = "BIDDING",

    /* Bids for the game has been set, and the round is in progress. */
    PLAYING = "PLAYING",

    /* Rounds ended and the points are being calculated. */
    TALLYING = "TALLYING",

    /* Game has ended and the winner is chosen. */
    FINISHED = "FINISHED",
}