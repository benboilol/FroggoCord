s=open('public/scripts/message-actions.js',encoding='utf-8').read()
s=s.replace('await addDoc(collection(db,"messages"),{text:`<img src="${url}" style="max-width: min(320px, 100%); border-radius:8px; display:block;">`,user,channel:chan,pfp,timestamp:serverTimestamp()})',
            'await addDoc(collection(db,"messages"),{text:`<img src="${url}" style="max-width: min(320px, 100%); border-radius:8px; display:block;">`,user,uid:(auth.currentUser&&auth.currentUser.uid)||null,channel:chan,pfp,timestamp:serverTimestamp()})')
open('public/scripts/message-actions.js','w',encoding='utf-8').write(s)
print('done')
