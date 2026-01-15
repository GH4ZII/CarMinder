import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";


const firebaseConfig = {
  apiKey: "AIzaSyBhDK3_z4cQsdkJ5IJl-3Knofwa43QQWhk",
  authDomain: "carminder-b2486.firebaseapp.com",
  projectId: "carminder-b2486",
  storageBucket: "carminder-b2486.firebasestorage.app",
  messagingSenderId: "85293564173",
  appId: "1:85293564173:web:9ae35e29273eda63187044"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

export { app, auth };
