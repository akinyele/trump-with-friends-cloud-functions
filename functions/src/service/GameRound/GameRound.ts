

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
