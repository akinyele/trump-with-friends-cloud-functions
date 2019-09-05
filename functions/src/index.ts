import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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


export const onGamesUpdated = functions.firestore.document('Game/{gameId}').onUpdate(change => {
    let gameRoomData = change.after.data();
    let isRoomFull = false;

    // Check to see if the game room is full


    return new Promise((accepted, rejected) => {
        console.log("game room updated", gameRoomData);

        if (gameRoomData) {
            isRoomFull = gameRoomData.playerAmount == gameRoomData.players.length;

            if (isRoomFull) {
                // Notify users that game room is full.
                console.log("game room full notify user")
            }
        }
        accepted("success");
    })
});