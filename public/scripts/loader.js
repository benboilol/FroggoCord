import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import {getFirestore,collection,addDoc,onSnapshot,query,orderBy,limit,startAfter,serverTimestamp,doc,updateDoc,deleteDoc,setDoc,where,getDocs,getDoc} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
window.froggocordFirebase={initializeApp,getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,onAuthStateChanged,signOut,getFirestore,collection,addDoc,onSnapshot,query,orderBy,limit,startAfter,serverTimestamp,doc,updateDoc,deleteDoc,setDoc,where,getDocs,getDoc};
const appScripts=[
    'app-core.js',
    'navigation-servers.js',
    'server-permissions.js',
    'message-actions.js',
    'chat-view.js'
];
for(const file of appScripts){
    await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        const scriptUrl=new URL(file,import.meta.url);
        scriptUrl.searchParams.set('v',Date.now().toString());
        script.src=scriptUrl;
        script.onload=resolve;
        script.onerror=()=>reject(new Error(`Could not load ${file}`));
        document.head.append(script);
    });
}
function showUpdateNotice(){
    if(document.getElementById('app-update-notice'))return;
    const notice=document.createElement('aside');
    notice.id='app-update-notice';
    notice.setAttribute('role','status');
    notice.setAttribute('aria-live','polite');
    notice.innerHTML='<span>A newer version of FroggoCord is available.</span><button type="button">Reload to update</button>';
    notice.querySelector('button').addEventListener('click',()=>{
        const updateUrl=new URL(window.location.href);
        updateUrl.searchParams.set('app-update',Date.now().toString());
        window.location.replace(updateUrl.href);
    });
    document.body.append(notice);
}

const monitoredAssets = [
    new URL('/', window.location.origin),
    new URL(import.meta.url),
    new URL('../style.css', import.meta.url),
    ...appScripts.map((file) => new URL(file, import.meta.url)),
    ...['ash', 'obsidian', 'magma', 'fulgurite', 'plasma', 'alpenglow', 'frostbite', 'phantom', 'crystal', 'verdant']
        .map((theme) => new URL(`../themes/${theme}.css`, import.meta.url))
];

async function fetchAsset(url) {
    const checkUrl = new URL(url);
    checkUrl.searchParams.set('update-check', Date.now().toString());
    const response = await fetch(checkUrl, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Update check failed for ${url.pathname}: ${response.status}`);
    }
    return response.text();
}

const initialAssetContents = new Map(
    await Promise.all(monitoredAssets.map(async (url) => [url.pathname, await fetchAsset(url)]))
);

const UPDATE_CHECK_INTERVAL_MS = 60000;
let updateCheckInProgress = false;

async function checkForAppUpdate(){
    if (updateCheckInProgress) return;
    updateCheckInProgress = true;
    try{
        const currentAssetContents = await Promise.all(
            monitoredAssets.map(async (url) => [url.pathname, await fetchAsset(url)])
        );
        if (currentAssetContents.some(([url, contents]) => contents !== initialAssetContents.get(url))) {
            showUpdateNotice();
        }
    }
    catch(error){console.warn('Could not check for a FroggoCord update:',error);}
    finally{updateCheckInProgress = false;}
}
window.froggocordCheckForUpdate = checkForAppUpdate;
window.setTimeout(() => {
    checkForAppUpdate();
    window.setInterval(checkForAppUpdate, UPDATE_CHECK_INTERVAL_MS);
}, 10000);