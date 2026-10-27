s=open('public/scripts/app-core.js',encoding='utf-8').read()
s=s.replace('await setDoc(doc(db, "users", user), { user, pfp, lastSeen: serverTimestamp() }, { merge: true })',
            'await setDoc(doc(db, "users", user), { user, pfp, uid: (auth.currentUser && auth.currentUser.uid) || null, lastSeen: serverTimestamp() }, { merge: true })')
# two occurrences of compact form
import re
s=s.replace('await setDoc(doc(db,"users",user),{user,pfp,lastSeen:serverTimestamp()},{merge:true})',
            'await setDoc(doc(db,"users",user),{user,pfp,uid:(auth.currentUser&&auth.currentUser.uid)||null,lastSeen:serverTimestamp()},{merge:true})')
s=s.replace('const payload = { text: t, user, channel: chan, pfp, timestamp: serverTimestamp(), clientMsgId: clientId };',
            'const payload = { text: t, user, uid: (auth.currentUser && auth.currentUser.uid) || null, channel: chan, pfp, timestamp: serverTimestamp(), clientMsgId: clientId };')
s=s.replace('const payload = { text: pending.text, user: pending.user, channel: pending.channel, pfp: pending.pfp, timestamp: serverTimestamp(), clientMsgId: clientId };',
            'const payload = { text: pending.text, user: pending.user, uid: (auth.currentUser && auth.currentUser.uid) || null, channel: pending.channel, pfp: pending.pfp, timestamp: serverTimestamp(), clientMsgId: clientId };')
open('public/scripts/app-core.js','w',encoding='utf-8').write(s)
print('done')
