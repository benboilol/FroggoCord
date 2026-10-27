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
  'server-permissions.js',
  'message-actions.js',
  'chat-view.js'
];

const assetVersion = '20261026-restore1';

for (const file of appScripts) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const scriptUrl = new URL(file, import.meta.url);
    scriptUrl.searchParams.set('v', assetVersion);
    script.src = scriptUrl;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${file}`));
    document.head.append(script);
  });
}

function showUpdateNotice() {
  if (document.getElementById('app-update-notice')) return;
  const notice = document.createElement('aside');
  notice.id = 'app-update-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.innerHTML = '<span>A newer version of FroggoCord is available.</span><button type="button">Reload to update</button>';
  notice.querySelector('button').addEventListener('click', () => window.location.reload());
  document.body.append(notice);
}

async function checkForAppUpdate() {
  try {
    const versionUrl = new URL('../version.json', import.meta.url);
    versionUrl.searchParams.set('check', Date.now().toString());
    const response = await fetch(versionUrl, { cache: 'no-store' });
    if (!response.ok) return;
    const deployment = await response.json();
    if (deployment.version && deployment.version !== assetVersion) showUpdateNotice();
  } catch (error) {
    // A temporary network failure should not interrupt the running app.
  }
}

checkForAppUpdate();
window.setInterval(checkForAppUpdate, 60_000);
