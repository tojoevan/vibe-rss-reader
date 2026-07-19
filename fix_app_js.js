const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public/js/app.js');
let content = fs.readFileSync(file, 'utf8');

// Add the admin click listener back right after the logout listener
const search = `$('btn-logout').addEventListener('click', () => {`;
if (content.includes(search)) {
    const insert = `
  $('btn-admin').addEventListener('click', () => {
    openAdminPanel();
    $('user-dropdown').style.display = 'none';
  });

  // Dropdown toggle logic
  $('user-name').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('user-dropdown');
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    const menu = $('user-dropdown');
    if (menu) menu.style.display = 'none';
  });
`;
    content = content.replace(search, insert + search);
    fs.writeFileSync(file, content);
    console.log("Fixed app.js dropdown and admin events!");
} else {
    console.log("Could not find btn-logout listener");
}
