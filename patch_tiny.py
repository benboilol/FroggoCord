s=open('public/scripts/app-core.js',encoding='utf-8').read()
old='          <img data-src="${escHtml(u)}" src="" alt="gif" loading="lazy" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:8px; display:block; background:transparent; ${blur}">'
new='          <img data-src="${escHtml(u)}" src="" alt="gif" loading="lazy" style="max-width:100%; border-radius:8px; display:block; background:transparent; min-height:60px; ${ar} ${blur}">'
assert old in s, 'old not found'
s=s.replace(old,new,1)
# wrap: keep aspect-ratio? remove aspect-ratio from wrap to size to img; but keep position relative
old2='return `<div class="gif-wrap" data-gif-url="${escHtml(u)}" style="position:relative; display:inline-block; max-width:min(320px,100%); aspect-ratio:${ar.replace("aspect-ratio:","").replace(";","")}; overflow:hidden; border-radius:8px;">'
new2='return `<div class="gif-wrap" data-gif-url="${escHtml(u)}" style="position:relative; display:inline-block; max-width:min(320px,100%);">`'
assert old2 in s, 'old2 not found'
s=s.replace(old2,new2,1)
open('public/scripts/app-core.js','w',encoding='utf-8').write(s)
print('ok')
