import * as admin from 'firebase-admin';
import {GAME_ROOM_COLLECTION, GAME_ROUND_COLLECTION, HANDS_COLLECTIONS} from "../const/FirststoreConstants";
// tslint:disable-next-line:no-implicit-dependencies
import { DocumentReference, WriteResult } from '@google-cloud/firestore';
import {DocumentSnapshot} from "firebase-functions/lib/providers/firestore";


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


export async function createRound(round: any, roomCode: string): Promise<DocumentReference> {
    return admin.firestore()
        .collection(GAME_ROOM_COLLECTION)
        .doc(roomCode)
        .collection(GAME_ROUND_COLLECTION)
        .add(round);
}

export async function updateGameRound(roomId: string, roundId: string, updatedGameRound: any): Promise<any> {
    console.log("updating game room");
    console.log(updatedGameRound);

    return admin.firestore()
        .collection(GAME_ROOM_COLLECTION)
        .doc(roomId)
        .collection(GAME_ROUND_COLLECTION)
        .doc(roundId)
        .update(updatedGameRound)
        .then( _ => {
            console.log(" Game Round updated")
        })
}


export async function createHand(roomCode: string, roundId: string, hand: any) : Promise<DocumentReference>{
    return admin.firestore()
        .collection(GAME_ROOM_COLLECTION)
        .doc(roomCode)
        .collection(GAME_ROUND_COLLECTION)
        .doc(roundId)
        .collection(HANDS_COLLECTIONS)
        .add(hand);
}

export async function updateGameRoom(roomCode: string, gameRoom: any) : Promise<WriteResult> {
    return admin.firestore()
        .collection(GAME_ROOM_COLLECTION)
        .doc(roomCode)
        .update(gameRoom);
}

export async function getGameRoom(roomCode: string): Promise<DocumentSnapshot> {
    return admin.firestore()
    .collection(GAME_ROOM_COLLECTION)
    .doc(roomCode)
    .get()
}