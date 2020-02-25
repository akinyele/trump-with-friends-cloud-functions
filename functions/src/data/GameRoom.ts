export interface GameRoom {
    gameMode: any,
    roomName: string,
    roomCode: string,
    roomType: any,
    isStarted: any,
    gameState: RoomStates,
    numberOfRounds: number,
    amountJoined: number,
    maxPlayers: number,
    players: Array<string>,
    roundId?: string,
    round: number,
    scoreLog: Array<any>,
    timeCreated: string,
    createdBy: string,
}


export enum RoomType {
    PUBLIC,
    PRIVATE
}


export enum GameMode {
    CLASSIC,
}

export enum RoomStates {
    /* At this state the players are joining the room. */
    STARTING,

    /* Rounds has started and in progress. */
    PLAYING,

    /* Game has ended and the winner is chosen. */
    FINISHED
}

