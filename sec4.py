s=open('public/scripts/navigation-servers.js',encoding='utf-8').read()
s=s.replace("await addDoc(collection(db,'servers'), { name, owner: user, inviteCode: code, members: [user], admins: [], channels: [{name:'general', id:'general'}], createdAt: serverTimestamp() })",
            "await addDoc(collection(db,'servers'), { name, owner: user, ownerUid: (auth.currentUser&&auth.currentUser.uid)||null, inviteCode: code, members: [user], memberUids: [(auth.currentUser&&auth.currentUser.uid)||null], admins: [], channels: [{name:'general', id:'general'}], createdAt: serverTimestamp() })")
s=s.replace('await addDoc(collection(db, "messages"), { text: inviteCard, user, channel: chan, pfp, timestamp: serverTimestamp() })',
            'await addDoc(collection(db, "messages"), { text: inviteCard, user, uid: (auth.currentUser&&auth.currentUser.uid)||null, channel: chan, pfp, timestamp: serverTimestamp() })')
open('public/scripts/navigation-servers.js','w',encoding='utf-8').write(s)
print('done')
