Please know that this is made partially with AI, because I do not know how to do programming, although the other collaborators may know how.
# FroggoCord Development Rules

## Instructions for Ben
Include these rules in every AI coding prompt.

## Instructions for the AI coding agent

1. Before starting a task, run `git pull` and check the working tree. Do not overwrite or discard existing changes.
2. Keep changes focused on the requested task. Do not modify unrelated code.
3. After editing, inspect the diff and test the changes where possible.
4. Commit and push only after the changes have been reviewed and tested. Never push knowingly broken or incomplete work.
5. Do not edit `Froggocord.html`. It is a legacy redirect.
6. `public/index.html` is the main page. Put HTML markup in this file, but do not embed JavaScript or CSS in it.
7. `public/script.js` contains JavaScript only.
8. `public/style.css` contains CSS only.
9. The JavaScript and CSS files are already linked from `index.html`. Preserve those links unless changing them is explicitly necessary.
10. Do not remove, rename, or move existing files or functions without a clear technical reason.
11. Before finishing, summarize the changes, tests performed, and any known problems. Append these to changelog.txt

## Important
Do not assume that code is correct just because it runs. Preserve existing functionality, check Firebase permissions and data access, and avoid introducing unnecessary database reads or writes.