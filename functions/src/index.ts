import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {DocumentSnapshot} from "firebase-functions/lib/providers/firestore";
import {GameRoundStates} from "./service/GameRound/GameRound";

const USER_COLLECTION: string = "User";
const GAME_ROOM_COLLECTION: string = "Game";
const GAME_ROUND_COLLECTION: string = "Rounds";
const HANDS_COLLECTIONS: string = "Hands";
const BIDS_COLLECTIONS: string = "Bids";


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

export const testFunction = functions.https.onRequest(async (request, response) => {
    const body = request.body;
    const trumpGame = await createRound(body.players);


    // const hello = await admin.firestore().doc(`Game/OkrWZPznW`).collection("Rounds").add({hello: "hello"});
    // console.log("Hellloooo", hello);

    response.send(trumpGame);
});

/**
 * Cloud function that triggers when game room is updated and does following:
 * 1. Checks if game is ready. ie if all the users have joined.
 * 2. Create the first round of the game.
 * 2. Notify the user's when the game is ready.
*/
export const onGameRoomUpdated = functions.firestore.document('Game/{gameId}').onUpdate(async change => {
    const gameRoomData = change.after.data();

    let isRoomFull = false;

    // Check to see if the game room is full
    console.log("game room updated", gameRoomData);

    if (gameRoomData) {
        isRoomFull = gameRoomData.playerAmount.toString() === gameRoomData.players.length.toString();

        if (isRoomFull && !gameRoomData.gameStarted) {
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

            const [firstRound, hands] =  await createRound(gameRoomData.players);

            // Create the first round
            const gameRound = await admin.firestore()
                .doc(`${GAME_ROOM_COLLECTION}/${gameRoomData.roomCode}`)
                .collection(GAME_ROUND_COLLECTION)
                .add(firstRound);


            // create a hands sub collections
            // @ts-ignore
            for (const hand of hands) {
                await admin.firestore()
                    .doc(`${GAME_ROOM_COLLECTION}/${gameRoomData.roomCode}/${GAME_ROUND_COLLECTION}/${gameRound.id}`)
                    .collection(HANDS_COLLECTIONS)
                    .add(hand);
            }

            // Update the game room
            gameRoomData.gameStarted = true;
            gameRoomData.currentRound = gameRound.id;
            gameRoomData.roundNumber = 1;
            await admin.firestore().doc(`Game/${gameRoomData.roomCode}`).update(gameRoomData);



            console.log("sending notification to users", tokens, payload);
            return notifyUsers(tokens, payload)
                .then(devicesResponse => {
                    console.log("Users notified of game ready", devicesResponse);
                })
                .catch(error => {
                    console.error("Failed to notify users about game ready", error);
                })
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
export const onRoundUpdated = functions.firestore.document( `Game/{gameId}/${GAME_ROUND_COLLECTION}/{roundId}`)
    .onUpdate( async (change, context) => {

        const gameRound = change.after.data();
        if (!gameRound) {
            console.error("Failed to parse game rounds change", gameRound);
            return;
        }

        const  ROUND_CURRENT_STATE = gameRound.state;
        const {gameId, roundId} = context.params;



        // check the current state of the game
        // NB first state is bidding
        switch (GameRoundStates[ROUND_CURRENT_STATE]) {
            case GameRoundStates.BIDDING: {
                console.log("Game in bidding state");
                // bidding state

                // Get the bids
                const bidsSnapshot = await admin.firestore()
                    .collection(GAME_ROOM_COLLECTION)
                    .doc(gameId)
                    .collection(GAME_ROUND_COLLECTION)
                    .doc(roundId)
                    .collection(BIDS_COLLECTIONS)
                    .get();

                const bidsCollection = bidsSnapshot.docs.map( snapshot =>
                    ({...snapshot.data()})
                );

                console.log(`bids: ${bidsCollection}`);

                const players = gameRound.players;

                // - check to see if all the players have bid
                const bidsLeft = players.length - bidsCollection.length;

                // - create first pot (the order determines who plays first)
                if (!bidsLeft) {
                    // update game round to next state;
                    const newState =  GameRoundStates.PLAYING;
                    gameRound.state = newState;
                    console.log(`all bids have been set, setting game state to ${newState}`);
                } else {
                    console.log(`${bidsLeft} players left to set bid`);
                    return Promise.reject()
                }

                break;
            }
            case GameRoundStates.PLAYING: {
                // playing state
                // - check everyone play in the first pot
                // - winner is determined
                // - check if still playing
                // - move on to next pot
                break;
            }
            case GameRoundStates.TALLYING: {
                // Tallying
                // - calculate scores
                break;
            }
            case GameRoundStates.FINISHED: {
                // End
                // - create next round
                break;
            }
            default: {
                console.log(`Game is unrecognized state : ${ROUND_CURRENT_STATE}`);
                return Promise.reject(`Game is unrecognized state : ${ROUND_CURRENT_STATE}`)
            }
        }

        return updateGameRound(gameId, roundId, gameRound)
    });

//----- Helper Functions

function notifyUsers(userTokens: string[], messagePayload: object) {
    return admin.messaging().sendToDevice(userTokens, messagePayload)
}

function updateGameRound(roomId: string, roundId: string, updatedGameRound: Object) {
    return admin.firestore()
        .collection(GAME_ROOM_COLLECTION)
        .doc(roomId)
        .collection(GAME_ROUND_COLLECTION)
        .doc(roundId)
        .update(updatedGameRound)
        .then( result => {
            console.log(" Game Round updated")
        })
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

/**
 * Creates a new round in a game.
 * @param players
 */
async function createRound(players: Array<any>) {
    let hands: any[];
    let deck = createDeck();
    const round = 1;

    // shuffle the deck
    deck = shuffleCards(deck);

    // share the cards
    [deck, hands] = shareCards(players, deck, round);

    const trump = deck.pop();

    const gameRound = {
        id: "",
        gameRound: round,
        roundState: GameRoundStates.BIDDING,
        theTrump: trump,
        scoreLog: "",
        bids: Array(),
        players: players,
        pots: [],
        deck: deck,
    };

    return [gameRound, hands]
}

function createDeck() {
    const cardData = {
        ranks: ["A", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "J", "Q", "K"],
        // suits: ['♥', '♦', '♠', '♣'],
        // ranks: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
        suits: ['HEART', 'DIAMOND', 'SPADE', 'CLUB'],
    };
    let id = 1;
    const cards = Array<object>();

    // tslint:disable-next-line:prefer-for-of
    for (let s = 0; s < cardData.suits.length; s++) {
        for (let r = 0; r < cardData.ranks.length; r++) {
            const card = {
                id: id,
                suite: cardData.suits[s],
                rank: cardData.ranks[r]
            };
            cards.push(card);
            id++;
        }
    }

    return cards;
}

function shuffleCards(cards: Array<Object>) : Array<Object>{
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

function shareCards(players: Array<string>, deck: Array<Object>, round: number): Array<any> {

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
