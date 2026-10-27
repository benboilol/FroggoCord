lines = open('public/scripts/app-core.js', encoding='utf-8').read().splitlines()
block = open('gif_block2.txt', encoding='utf-8').read().splitlines()
start = 720
end = None
for j in range(start, len(lines)):
    if '</div>' in lines[j] and ';' in lines[j]:
        end = j
        break
print('start', start+1, 'end', end+1 if end is not None else None)
if end is not None:
    lines[start:end+1] = block
    open('public/scripts/app-core.js', 'w', encoding='utf-8').write('\n'.join(lines))
    print('done')
else:
    print('no end found')
