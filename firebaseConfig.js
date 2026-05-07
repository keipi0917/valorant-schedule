import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 先ほどコピーした情報をここに貼り付けます
const firebaseConfig = {

    apiKey: "AIzaSyC4jLwivEr9eLPmyz_YnZay2LftavHBXTM",
    
    authDomain: "v-hub-for-schedule.firebaseapp.com",
    
    databaseURL: "https://v-hub-for-schedule-default-rtdb.asia-southeast1.firebasedatabase.app",
    
    projectId: "v-hub-for-schedule",
    
    storageBucket: "v-hub-for-schedule.firebasestorage.app",
    
    messagingSenderId: "609831878371",
    
    appId: "1:609831878371:web:606cbd1d3e67147aed4fd6",
    
    measurementId: "G-0QV9E0YMCS"
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);
// データベース（Firestore）を使えるようにしてエクスポート
export const db = getFirestore(app);