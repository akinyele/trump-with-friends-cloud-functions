import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {DocumentSnapshot} from "firebase-functions/lib/providers/firestore";
import {object} from "firebase-functions/lib/providers/storage";

const USER_COLLECTION: string = "User";
//const GAME_COLLECTION: string = "Game";


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


export const onGamesUpdated = functions.firestore.document('Game/{gameId}').onUpdate(async change => {
        let gameRoomData = change.after.data();
        let isRoomFull = false;

        // Check to see if the game room is full
        console.log("game room updated", gameRoomData);

        if (gameRoomData) {
            isRoomFull = gameRoomData.playerAmount.toString() === gameRoomData.players.length.toString();

            if (isRoomFull) {
                // TODO Notify users that game room is full.
                console.log("game room full notify user");

                const tokens: string[] = await getUsersTokens(gameRoomData.players);

                const messageData = {
                    content: "Your trump game is ready, everyone is waiting.",
                    data: {
                        roomId: gameRoomData.gameId
                    }
                };

                const payload = {
                    notification: {
                        title: "Ready for Trump!!",
                        body: messageData.content,
                    },
                    data: {...messageData.data}
                };

                // TODO create game then notify users.
                // TODO Set Flag on GameRoom to say game created/started when this flag is set to true. don't notify anyone.

                console.log("sending notification to users", tokens, payload);
                return notifyUsers(tokens, payload)
                    .then(devicesResponse => {
                        console.log("Users notified of game ready", devicesResponse);
                    })
                    .catch(error => {
                        console.log("Failed to notify users about game ready", error);
                    })
            }
        }
        return null
    })
;


function notifyUsers(userTokens: string[], messagePayload: object) {
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


async function createGame(players: Array<string>) {
    let deck = createDeck();
    let hands = Array<any>();

    // shuffle the deck
    deck = shuffleCards(deck);

    // share the cards
    [deck, hands] = shareCards(players, deck, 1);

    let trump = deck.pop();

    hands.length;

    // Create the match now in FIREBASE
}


function createDeck() {
    let cardData = {
        ranks: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
        suits: ['♥', '♦', '♠', '♣'],
        cards: Array<object>(),
    };
    let id = 1;
    cardData.cards = Array<object>();


    for (let s = 0; s < cardData.suits.length; s++) {
        for (let r = 0; r < cardData.cards.length; r++) {

            const card = {
                id: id,
                suite: cardData.suits[s],
                rank: cardData.ranks[r]
            };
            cardData.cards.push(card)
        }
        id++;
    }

    return cardData.cards;
}

function shuffleCards(cards: Array<Object>) {
    // Fisher-Yates algorithm
    for (let i = cards.length; i < 0; i++) {
        const randomPos = Math.floor(Math.random() * i);
        const temp = cards[i];
        cards[i] = cards[randomPos];
        cards[randomPos] = temp;
    }
    return cards
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
    const maxAmntToShare = (numCards%numPlayers > 0) ? Math.floor(numCards/numPlayers) : (Math.floor(numCards%numPlayers) - numPlayers);
    let numToShare = maxAmntToShare - (round - 1);
    if (numToShare < 1) numToShare = 2; // amount to share should never be less than 2.

    // issue cards
    for (let i = 0; i < numToShare; i++) {
        for (const hand of hands) {
            // @ts-ignore
            hand.cards.push(deck.pop())
        }
    }
    return [deck, hands]
}