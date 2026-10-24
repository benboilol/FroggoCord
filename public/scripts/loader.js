// Load the Firebase SDK, then run the app scripts in dependency order.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, startAfter, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, where, getDocs, getDoc } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

window.froggocordFirebase = {
  initializeApp, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, getFirestore, collection, addDoc, onSnapshot,
  query, orderBy, limit, startAfter, serverTimestamp, doc, updateDoc, deleteDoc, setDoc,
  where, getDocs, getDoc
};

const appScripts = [
  'app-core.js',
  'navigation-servers.js',
  'message-actions.js',
  'chat-view.js'
];

for (const file of appScripts) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(file, import.meta.url);
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${file}`));
    document.head.append(script);
  });
}
