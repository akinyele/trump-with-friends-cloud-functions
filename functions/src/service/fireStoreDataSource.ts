import * as admin from 'firebase-admin';
import {GAME_ROOM_COLLECTION, GAME_ROUND_COLLECTION, HANDS_COLLECTIONS} from "../const/FirststoreConstants";


export async function gameRoundCollection(roomCode: string) {
    return admin.firestore()
        .collection(GAME_ROOM_COLLECTION)
        .doc(roomCode)
        .collection(GAME_ROUND_COLLECTION)
}

export async function gameRoomsCollection() {
    return admin.firestore()
        .collection(GAME_ROOM_COLLECTION)
}

export async function handsCollection(roomCode: string, roundId: string) {
    return admin.firestore()
        .collection(GAME_ROOM_COLLECTION)
        .doc(roomCode)
        .collection(GAME_ROUND_COLLECTION)
        .doc(roundId)
        .collection(HANDS_COLLECTIONS);
}