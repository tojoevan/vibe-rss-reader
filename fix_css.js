const fs = require('fs');
const path = require('path');
const cssPath = path.join(__dirname, 'public/css/style.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Find the dark theme block
const darkThemeStart = css.indexOf('[data-theme="dark"] {');
const darkThemeEnd = css.indexOf('}', darkThemeStart) + 1;

const darkThemeBlock = css.substring(darkThemeStart, darkThemeEnd);

// Remove dark theme block from its current position
css = css.replace(darkThemeBlock, '');

// Find where to put the dark theme block (at the end of the variables section)
// We want to put it right before the media query
const mediaQueryStart = css.indexOf('/* --- Reduced motion --- */');

css = css.substring(0, mediaQueryStart) + '\n' + darkThemeBlock + '\n\n' + css.substring(mediaQueryStart);

// Now we need to remove the closing brace of :root and put it before the dark theme block
// But wait! Right now :root closes at line 42.
// Let's just remove the first closing brace `}` after :root
const rootStart = css.indexOf(':root {');
const firstBraceAfterRoot = css.indexOf('}', rootStart);
css = css.substring(0, firstBraceAfterRoot) + css.substring(firstBraceAfterRoot + 1);

// And we need to add a closing brace before the dark theme block
const darkThemeStartNew = css.indexOf('[data-theme="dark"] {');
css = css.substring(0, darkThemeStartNew) + '}\n\n' + css.substring(darkThemeStartNew);

fs.writeFileSync(cssPath, css);
console.log("Fixed CSS structure!");
