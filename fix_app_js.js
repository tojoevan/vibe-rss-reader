const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'public/js/app.js');
let content = fs.readFileSync(file, 'utf8');

// Fix 1: sidebar overlay append
content = content.replace(
  "document.body.appendChild(overlay);",
  "document.getElementById('app-main').appendChild(overlay);"
);

// Fix 2: PC categories click handling
const pcTabsCode = `
  // ============================================================
  // PC TABS (Categories)
  // ============================================================
  const pcCategories = document.getElementById('pc-categories');
  if (pcCategories) {
    pcCategories.addEventListener('click', (e) => {
      const item = e.target.closest('.feed-item');
      if (!item) return;

      state.currentTab = item.dataset.tab;
      state.currentPage = 1;
      
      // Update UI for PC categories
      pcCategories.querySelectorAll('.feed-item').forEach(li => li.classList.remove('active'));
      item.classList.add('active');

      // Update mobile tabs to match
      mobileTabs.querySelectorAll('.tab-btn').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === state.currentTab);
      });

      // Clear feed selection
      $('feed-list').querySelectorAll('.feed-item').forEach(li => li.classList.remove('active'));
      
      const titleName = item.querySelector('.feed-name')?.textContent || '最新资讯';
      feedColumnTitle.textContent = titleName;

      if (window.innerWidth <= 768) {
        closeSidebar();
      }

      Store.invalidateArticles();
      loadArticles(true);
      updateMarkAllReadVisibility();
    });
  }
`;

// Insert the PC tabs code right after mobile tabs code
const mobileTabsAnchor = "Store.invalidateArticles();\n    loadArticles(true);\n    updateMarkAllReadVisibility();\n  });";
if (content.includes(mobileTabsAnchor)) {
  content = content.replace(mobileTabsAnchor, mobileTabsAnchor + "\n" + pcTabsCode);
} else {
  console.log("Could not find mobile tabs anchor");
}

fs.writeFileSync(file, content);
console.log("Fixed app.js successfully");
