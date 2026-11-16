import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnhc1EbP7LcwfNlEtCtOB1g3PGdylDA14",
  authDomain: "elmundodelishi.firebaseapp.com",
  projectId: "elmundodelishi",
  storageBucket: "elmundodelishi.firebasestorage.app",
  messagingSenderId: "993277902278",
  appId: "1:993277902278:web:6269876e662b1b133546c7",
  measurementId: "G-XTEL1Q62H6"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
