import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {DocumentSnapshot} from "firebase-functions/lib/providers/firestore";
// @ts-ignore
import {createRound, getMaxAmountOfCardsToDeal, getTotalRounds, getWinner,} from "./service/GameRound/GameRound";
import {GameRound, GameRoundStates} from "./data/GameRound"
import {Card} from "./data/Card";
import * as fireStore from "./service/fireStoreDataSource";
import {GameRoomStates} from "./service/Game/GameRoom";
import {RoomStates} from "./data/GameRoom";
import {shuffle} from "./utils";

const USER_COLLECTION: string = "User";
const GAME_ROOM_COLLECTION: string = "Game";
const GAME_ROUND_COLLECTION: string = "Rounds";
const HANDS_COLLECTIONS: string = "Hands";


/**
 *
 * TODO Change the structure so that olny the respective user can see their hand.
 * TODO Create a hands' sub collection that store the current hands for the user. Use the user id as the key so that only the user can draw their hand.
 *
 * TODO: start logging function so that we can debug from firebase console.
 *
 */

/**
 *
 *  Rules for terminating cloud functions
 *  1 - HTTP triggers - these ends when a response is sent back.
 *  2 - Background Trigger - these should always return a promise.
 *  NB - The promise should only be resolved only after the work that was started is completed.
 */


admin.initializeApp();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript
export const getGames = functions.https.onRequest((request, response) => {
    admin.firestore().doc("Game").get()
        .then(gamesSnapshot => {
            const data = gamesSnapshot.data();
            console.log(data);
            response.send(data);
        })
        .catch(error => {
            console.log(error);
            response.send("Something went wrong")
        })
});

// export const testFunction = functions.https.onRequest(async (request, response) => {
//     const body = request.body;
//     const trumpGame = await createRound(body.players, 1, 12);
//
//
//     response.send(trumpGame);
// });

/**
 * Cloud function that triggers when game room is updated and does following:
 * 1. Checks if game is ready. ie if all the users have joined.
 * 2. Create the first round of the game.
 * 2. Notify the user's when the game is ready.
*/
export const onGameRoomUpdated = functions.firestore.document('Game/{gameId}').onUpdate(async change => {
    const gameRoomData = change.after.data() ;

    // Check to see if the game room is full
    console.log("game room updated", gameRoomData);

    if (gameRoomData) {
        const players = gameRoomData.players || [];
        const playerLeft = gameRoomData.maxPlayers - players.length;

        const isAllPlayers = !playerLeft && !gameRoomData.isStarted;
        if (isAllPlayers) {
            console.log("game room full notify user");
            const tokens: string[] = await getUsersTokens(gameRoomData.players);

            const messageData = {
                content: "Your trump game is ready, everyone is waiting.",
                data: {
                    roomCode: gameRoomData.roomCode
                }
            };

            const payload = {
                notification: {
                    title: "Ready for Trump!!",
                    body: messageData.content,
                },
                data: {...messageData.data}
            };
            const playerOrder = shuffle(players);

            // const CARDS_IN_DECK = 52;
            // const amountToDeal  = getMaxAmountOfCardsToDeal(gameRoomData.players.length, CARDS_IN_DECK);
            const amountToDeal  = 3;
            const [firstRound, hands] = createRound(playerOrder, 1, amountToDeal, players[0]);

            // Create the first round
            const gameRound = await fireStore.createRound(firstRound, gameRoomData.roomCode);


            // create a hands sub collections
            // @ts-ignore
            for (const hand of hands) {
                await admin.firestore()
                    .doc(`${GAME_ROOM_COLLECTION}/${gameRoomData.roomCode}/${GAME_ROUND_COLLECTION}/${gameRound.id}`)
                    .collection(HANDS_COLLECTIONS)
                    .add(hand);
            }

            // Update the game room
            gameRoomData.isStarted = true;
            gameRoomData.roundId = gameRound.id;
            gameRoomData.round = 1;
            gameRoomData.numberOfRounds = 4; // getTotalRounds(players.length);
            gameRoomData.gameState = RoomStates.PLAYING;
            await admin.firestore().doc(`Game/${gameRoomData.roomCode}`).update(gameRoomData);



            console.log("sending notification to users", tokens, payload);
            return notifyUsers(tokens, payload)
                .then(devicesResponse => {
                    console.log("Users notified of game ready", devicesResponse);
                })
                .catch(error => {
                    console.error("Failed to notify users about game ready", error);
                })

        } else {
            console.log(`${playerLeft} players left to join`);
            return Promise.reject();
        }
    }
    return null
});

/**
 * Cloud function that triggers whenever a game round is updated.
 * The main checks for this triggers are:
 * 1. Check to see if bids are finished.
 * 2. Check to see if everyone has played in pot.
 * 3. Check to see if the rounds has finish.
 * 4. Determine the scores for the round and add it to the room.
 */
export const onRoundUpdated = functions.firestore.document( `Game/{roomCode}/${GAME_ROUND_COLLECTION}/{roundId}`)
    .onUpdate( async (change, context) => {

        const data =  change.after.data();
        if (!data) {
            console.error("Failed to parse game rounds change", data);
            return;
        }

        const gameRound: GameRound = {
            // id: data.id,
            amountToDeal: data.amountToDeal,
            bids: data.bids,
            players: data.players,
            deck: data.deck,
            number: data.number,
            startingPlayer: data.startingPlayer,
            state: data.state,
            theTrump: data.theTrump,
            pot: data.pot,
            scores: data.scores,
            previousPots: data.previousPots,
            amountDealtLastRound: data.amountDealtLastRound,
            userPots: data.userPots,

        };

        const  ROUND_CURRENT_STATE = gameRound.state;
        const {roomCode, roundId} = context.params;


        // check the current state of the game
        // NB first state is bidding
        switch (GameRoundStates[ROUND_CURRENT_STATE]) {
            case GameRoundStates.BIDDING: {
                // bidding state
                console.log("Game in bidding state");

                const bids = gameRound.bids;
                console.log(`bids: ${bids}`);
                const players = gameRound.players;

                // - check to see if all the players have bid
                const bidsLeft = players.length - Object.keys(bids).length;

                // - create first pot (the order determines who plays first)
                if (!bidsLeft) {
                    // update game round to next state;
                    const newState =  GameRoundStates.PLAYING;
                    gameRound.state = newState;
                    console.log(`all bids have been set, setting game state to ${newState}`);

                    return fireStore.updateGameRound(roomCode, roundId, {
                        state: GameRoundStates.PLAYING
                    })

                } else {
                    console.log(`${bidsLeft} players left to set bid`);
                    return Promise.reject()
                }
            }
            case GameRoundStates.PLAYING: {
                // playing state
                console.log("Game is in playing state");

                const {players, pot, theTrump, userPots, startingPlayer, amountToDeal} = gameRound;
                let {previousPots} = gameRound;



                // - check everyone play in the first pot
                console.log("checking to see if all players played in this pot");
                const amntPlayed = Object.keys(pot).length;
                const numPlayers = players.length;


                for (const player of players) {
                    if (!pot[player]) { // if user hasn't played in pot yet then stop.
                        console.log(`${numPlayers - amntPlayed} player/s still left to play`);
                        return Promise.reject();
                    }
                }

                /**
                 *  Getting the first play in the pot.
                 *  the person who plays first in a pot is determined by;
                 *  the winner of the last pot or whoever is starting the round.
                 */
                let startingCard;
                if (!previousPots.length)  startingCard = pot[startingPlayer];
                else startingCard = pot[previousPots[0].winner];

                if (startingCard === undefined) {
                    console.log("Failed to get the first card in the pot");
                    return Promise.reject();
                }


                // get winner for the pot
                console.log("All players have played in this pot, getting the winner.");
                const potWinner = getWinner(new Map<string, Card>(Object.entries(pot)),  startingCard, theTrump);

                if (!potWinner) {
                    console.log("Failed to get winner");
                    return Promise.reject();
                }

                console.log(`${potWinner} won this pot`);


                // add pot to user pots
                if (!userPots[potWinner]) userPots[potWinner] = [pot];
                else userPots[potWinner] = [...userPots[potWinner], pot];


                const prevPot = {...pot, winner: potWinner};
                previousPots = [prevPot, ...previousPots]; // add last pot to the start of the array


                const potsPlayedInRounds = previousPots.length;
                let state = gameRound.state;
                const scores: any = {};


                // - check if everyone played in pot
                if (potsPlayedInRounds === amountToDeal) {
                    console.log("All the pots have been played in the rounds.");

                    // TODO calculate scores
                    //  update game room.
                    state = GameRoundStates.FINISHED;


                    // === Calculate the users scores;
                    const usersPots = gameRound.userPots;
                    const bids = gameRound.bids;

                    for (const player of players) {
                        // get the pots won by the user.
                        const userPot = usersPots[player] || []
                        const amountReceived = userPot.length;
                        const amountBid = bids[player];

                        if (amountBid > amountReceived) {
                            // score should be amount bid times ten
                            scores[player] = 0 - amountBid*10
                        } else {
                            // score should be amount bid times ten plus the amount went over.
                            scores[player] = amountBid*10 + (amountReceived-amountBid)
                        }
                    }
                }

                return fireStore.updateGameRound(roomCode, roundId, {
                    pot: {},
                    state,
                    previousPots,
                    userPots,
                    scores: scores,
                });
            }
            case GameRoundStates.TALLYING: {
                // Tallying
                // - calculate scores

                break;
            }
            case GameRoundStates.FINISHED: {
                // End
                console.log(`Game round has ended calculating scores for round.`);


                // - check if this was the last round.
                
                // @ts-ignore
                const isLastRound = gameRound.number === gameRound.numberOfRounds;

                if (isLastRound) {
                    // end game
                    console.log("This was the final round. The trump game has ended.");

                    // TODO update game score.
                    return  fireStore.updateGameRoom(roomCode, {
                        state: GameRoomStates.FINISHED
                    });
                } else {
                    
                    // - create next round (if game still going)
                    const players = gameRound.players;
                    const round = gameRound.number;
    
    
                    const sizeOfDeck = 52;
                    const maxAmountToDeal = getMaxAmountOfCardsToDeal(players.length, sizeOfDeck);
                    const minAmountToDeal = 2;
    
                    // get the amount to deal for the next round
                    const amountDealtThisRound = gameRound.amountToDeal;
                    const amountDealtLastRound = gameRound.amountDealtLastRound || 0;

                    console.log(`Creating next round, this had ${amountDealtThisRound} cards, last round had ${amountDealtLastRound}`,);


                    let amountToDealNextRound = amountDealtThisRound;

                    if (!amountDealtLastRound || amountDealtThisRound === maxAmountToDeal) { // if this is the first round.
                        console.log("Decrementing to get amount to deal next round.");
                        amountToDealNextRound--;
                    }
                    else if ( amountDealtLastRound > amountDealtThisRound && amountDealtThisRound !== minAmountToDeal) {
                        // if amount deal this round is not min and the last round was greater then we decrement.
                        console.log("Still decrementing to get amount to deal next round.");
                        amountToDealNextRound--
                    }
                    else if (amountDealtThisRound === minAmountToDeal && amountDealtLastRound !== minAmountToDeal) {
                        // if the amount deal this round was min and the amount deal last round was min then we got min again.
                        console.log("We are at the lowest amount to deal.");
                        amountToDealNextRound = minAmountToDeal;
                    }
                    else {
                        // if last round and current round was min then we increment
                        console.log("Start incrementing amount to deal.");
                        amountToDealNextRound++
                    }

                    // get the next starting player.
                    const indexOfPrevStarter = players.indexOf(gameRound.startingPlayer);
                    const nextIndex = indexOfPrevStarter + 1;
                    const nextStarter = (nextIndex < players.length) ? players[nextIndex] : players[0];

                    const [nextRound, hands]  = createRound(players, round + 1, amountToDealNextRound, nextStarter);
                    nextRound.amountDealtLastRound = amountDealtThisRound;



                    const nextRoundDoc = await fireStore.createRound(nextRound, roomCode);
    
                    for (const hand of hands) {
                        await fireStore.createHand(roomCode, nextRoundDoc.id, hand);
                    }

                    return fireStore.updateGameRoom(roomCode, {
                        roundId: nextRoundDoc.id,
                        round: nextRound.number,
                    });
                }
                
                // const {players} = gameRound= createRound(players);
            }
            default: {
                console.log(`Game is in unrecognized state : ${ROUND_CURRENT_STATE}`);
                return Promise.reject(`Game is unrecognized state : ${ROUND_CURRENT_STATE}`)
            }
        }

        console.log("No action taken");
        return Promise.reject();
    });

//----- Helper Functions

function notifyUsers(userTokens: string[], messagePayload: object): Promise<any> {
    return admin.messaging().sendToDevice(userTokens, messagePayload)
}

async function getUser(userId: string): Promise<DocumentSnapshot> {
    return admin.firestore().doc(`${USER_COLLECTION}/${userId}`).get()
}

async function getUsersTokens(userIds: string[]) {
    let tokens: string[] = [];
    console.log(`getting tokens for users ${userIds}`);

    const promises = [];
    for (const id of userIds) {
        promises.push(getUser(id))
    }

    try {
        const users = await Promise.all(promises);
        for (const user of users) {
            // @ts-ignore
            if (user.data()) tokens = tokens.concat(user.data().fcmToken)
        }
    } catch (e) {
        console.log("Failed to get users", e);
    }

    return Promise.resolve(tokens)
}
