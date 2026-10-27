s=open('public/scripts/chat-view.js',encoding='utf-8').read()
s=s.replace('await setDoc(doc(db, "friends", pairId), {from:user,to:u,status:"pending",timestamp:serverTimestamp()})',
            'await setDoc(doc(db, "friends", pairId), {from:user,fromUid:(auth.currentUser&&auth.currentUser.uid)||null,to:u,toUid:null,status:"pending",timestamp:serverTimestamp()})')
open('public/scripts/chat-view.js','w',encoding='utf-8').write(s)
print('done')
