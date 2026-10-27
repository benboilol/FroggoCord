s=open('public/scripts/chat-view.js',encoding='utf-8').read()
s=s.replace('await setDoc(doc(db,"presence",user),{user,status:\'online\',lastActive:serverTimestamp()})',
            'await setDoc(doc(db,"presence",user),{user,uid:(auth.currentUser&&auth.currentUser.uid)||null,status:\'online\',lastActive:serverTimestamp()})')
s=s.replace('setDoc(doc(db,"users",user),{user,lastSeen:serverTimestamp()},{merge:true})',
            'setDoc(doc(db,"users",user),{user,uid:(auth.currentUser&&auth.currentUser.uid)||null,lastSeen:serverTimestamp()},{merge:true})')
s=s.replace('await setDoc(doc(db,"users",user),{user,pfp,lastSeen:serverTimestamp()},{merge:true})',
            'await setDoc(doc(db,"users",user),{user,pfp,uid:(auth.currentUser&&auth.currentUser.uid)||null,lastSeen:serverTimestamp()},{merge:true})')
open('public/scripts/chat-view.js','w',encoding='utf-8').write(s)
print('done')
