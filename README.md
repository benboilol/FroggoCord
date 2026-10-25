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
7. JavaScript lives in `public/scripts/`. `loader.js` loads the Firebase SDK and the feature scripts in order; keep each script JavaScript-only.
8. `public/style.css` contains CSS only.
9. The JavaScript loader and CSS files are linked from `index.html`. Preserve those links unless changing them is explicitly necessary.
10. Do not remove, rename, or move existing files or functions without a clear technical reason.
11. Before finishing, summarize the changes, tests performed, and any known problems. Append these to changelog.txt

## Important
Do not assume that code is correct just because it runs. Preserve existing functionality, check Firebase permissions and data access, and avoid introducing unnecessary database reads or writes.

## JavaScript files

- `public/scripts/loader.js` imports Firebase and loads the app scripts sequentially as classic scripts. Keep the listed order: the files share app state, and `chat-view.js` registers authentication startup after the feature handlers are ready.
- `public/scripts/app-core.js` initializes Firebase and contains shared state, theme/settings behavior, dialogs, and profile image handling.
- `public/scripts/navigation-servers.js` contains channel and DM navigation, server creation/joining, and server settings.
- `public/scripts/message-actions.js` contains message actions, reactions, attachments, emoji/GIF features, and presence updates.
- `public/scripts/chat-view.js` contains profiles, message rendering/listeners, the message composer, and authentication startup.

## Adding a theme

1. Choose a lowercase, hyphenated theme ID, such as `example-theme`, and create `public/themes/<theme-id>.css`.
2. Start the file with a valid CSS comment, then copy the complete `:root` block from an existing theme. Change the values while keeping every custom property name. Do not put palette values in `style.css`; shared styles must use `var(--name)`.
3. Add the theme ID to `THEME_IDS` in `public/scripts/app-core.js` and add a matching theme option to the settings theme list in `public/index.html`. Use a hyphenated swatch class based on the ID, such as `example-theme-swatch`.
4. Add that swatch class and its three `--swatch-a`, `--swatch-b`, and `--swatch-c` values to every file in `public/themes/`. The active theme stylesheet provides the previews for every theme option.
5. If the new theme should be the default, update `DEFAULT_THEME` in `public/scripts/app-core.js` and the theme stylesheet link in `public/index.html`.
6. Bump `THEME_ASSET_VERSION` in `public/scripts/app-core.js` and the `?v=` values on the shared stylesheet, initial theme stylesheet, and loader script links in `public/index.html`. This gives browsers a new URL for updated assets.
7. Check that the theme defines all variables used by the shared stylesheet, run `node --check` on the JavaScript files in `public/scripts/`, inspect `git diff`, and append the change and verification results to `changelog.txt`.

Theme IDs, CSS filenames, the settings option's `data-theme`, and the swatch class must match. Keep theme definitions in CSS files and theme registration in the existing HTML and JavaScript files.

To make a theme follow the operating system's light or dark appearance, put one complete palette in `:root` and override the same custom properties inside `@media (prefers-color-scheme: dark)`. Alpenglow is an example of this pattern.
<<<<<<< Updated upstream
=======

## Emulator-only permission testing

`public/hacked.html` is a standalone security test client that signs in with a FroggoCord test account and calls the production Firestore API directly, without FroggoCord's UI permission checks. Firebase Authentication and Firestore Security Rules still apply. Its reads, writes, updates, and deletes affect live data, so use only a test account and disposable test records.
>>>>>>> Stashed changes
