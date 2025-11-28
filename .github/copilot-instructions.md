# GitHub Dashboard - Copilot Instructions

## Project Overview
This is a client-side JavaScript dashboard for visualizing GitHub pull request statistics for organizations. It's a pure static web application with no build process, deployed to GitHub Pages.

**Tech Stack:**
- Pure HTML/CSS/JavaScript (no transpilation/bundling required)
- Knockout.js for data binding
- Bootstrap 3 for UI
- jQuery for AJAX
- Chart.js (via knockout-chart-binding) for visualizations
- GitHub API for data fetching

**Size:** Small (~15 source files, no dependencies to install)

## Architecture & File Structure

### Main Application Files
- `index.html` - Landing page with organization selector and recent history
- `OpenPRs.html` - Main dashboard displaying PR statistics and charts
- `SearchResults.js` - Core logic: GitHub API integration, caching, data processing (407 lines)
- `GitHub-utils.js` - Date formatting utilities for GitHub API
- `CheckForUpdates.js` - Auto-reload on new deployments (currently disabled)

### Supporting Files
- `diffblue.css` - Custom styling including "disaster" class (red background for incomplete data)
- `knockout-extenders.js` - Custom Knockout.js extensions for date/numeric formatting
- `knockout-chart-binding.js` - Chart.js integration with Knockout
- `credentials.sample.js` - Template for GitHub authentication (copy to `credentials.js`)

### Configuration
- `.github/workflows/deploy.yml` - GitHub Pages deployment workflow
- `.vscode/launch.json` - Chrome debugger configuration
- `.gitignore` - Excludes `credentials.js` and build artifacts

### Special Files (Raspberry Pi deployment)
- `github-dashboard` - Bash script to run in kiosk mode on Raspberry Pi
- `install` - Setup script for Raspberry Pi autostart
- `autostart` - LXDE autostart configuration

## Key Architectural Concepts

### Data Flow
1. User selects organization on `index.html` → redirects to `OpenPRs.html?org=<name>`
2. `SearchResults(org)` constructor initializes with org parameter
3. Checks localStorage for cached PR data (key: `pr-cache-{org}-{authToken5chars}`)
4. Loads cached data immediately to UI, then fetches updates from GitHub API
5. Data saved progressively after each API page (100 PRs per page)
6. Auto-refresh every 300 seconds (5 minutes) using setTimeout pattern

### LocalStorage Cache Structure
```javascript
{
  projects: {
    "owner/repo": {
      prs: {
        "123": { created_at: "...", closed_at: "..." },
        "456": { created_at: "...", closed_at: null }
      }
    }
  },
  lastPRUpdate: "2025-11-28T10:30:00Z",
  isComplete: true,
  timestamp: "2025-11-28T10:35:00Z"
}
```

**Important:** PRs are keyed by project name and PR number. Only `created_at` and `closed_at` are stored per-PR. Other fields (`id`, `html_url`, `repository_url`, `number`) are reconstructed on load.

### GitHub API Limits
- Search API returns max 1000 results
- Data marked incomplete if: (a) more pages exist, OR (b) exactly 1000 PRs fetched
- Only marked complete if last page has <100 results, indicating we got everything

### Authentication
- Optional: copy `credentials.sample.js` to `credentials.js` and add GitHub token
- New approach: Store token in `localStorage['github-token']` (first 5 chars used in cache key)
- Without auth: only public repos visible

## Development Workflow

### Running Locally
**No build step required.** Just serve static files:

```bash
# Option 1: Python HTTP server (recommended)
cd /path/to/github-dashboard
python3 -m http.server 8000
# Then open: http://localhost:8000/index.html

# Option 2: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"

# Option 3: Any static file server
npx serve .
```

### Testing Changes
1. Make changes to HTML/CSS/JS files
2. Refresh browser (Ctrl+R or Cmd+R)
3. Check browser console for errors
4. Use browser DevTools to inspect:
   - Network tab: GitHub API calls
   - Application tab: localStorage cache
   - Console: Run `viewModel.searchResults.pullRequests().length` to check loaded PRs

### Debugging LocalStorage
```javascript
// View cache for current org
JSON.parse(localStorage.getItem('pr-cache-' + org + '-anon'))

// Count PRs per organization
Object.keys(localStorage).filter(k => k.startsWith('pr-cache-')).map(k => {
  const data = JSON.parse(localStorage[k]);
  const prCount = Object.values(data.projects || {}).reduce((sum, p) => 
    sum + Object.keys(p.prs || {}).length, 0);
  return { org: k, prs: prCount };
})

// Clear cache for testing
localStorage.removeItem('pr-cache-NathanJPhillips-anon')
```

## Deployment

### GitHub Pages (Automated)
- **Trigger:** Push to `master` branch
- **Workflow:** `.github/workflows/deploy.yml`
- **Process:** Checkout → Upload static files → Deploy
- **URL:** `https://{owner}.github.io/github-dashboard/`
- **Duration:** ~1-2 minutes

**No build step exists.** Files are deployed as-is. Future Vite migration commented in workflow.

### Manual Deployment
Not typically needed. Workflow supports manual trigger via Actions tab.

## Common Tasks

### Adding a New Feature
1. Edit relevant JS/HTML/CSS files
2. Test locally (python3 -m http.server 8000)
3. Commit and push to `master` (or feature branch)
4. Deployment happens automatically on merge to `master`

### Changing Default Organization
Edit `SearchResults.js` line ~26: Change `'NathanJPhillips'` in helper functions or constructor default.

### Adding New PR Statistics
1. Add computed observable to `SearchResults` constructor in `SearchResults.js`
2. Add display element to `OpenPRs.html` with `data-bind` attribute
3. Use Knockout.js computed observables for reactive updates

### Modifying Cache Structure
**Warning:** Changes to cache structure require cache version migration or clearing user caches.
Cache key format: `pr-cache-{org}-{authKey}` where authKey is first 5 chars of token or 'anon'.

## Validation & CI

### Pre-commit Checks
**None automated.** Manual validation only:
1. Open `OpenPRs.html` in browser
2. Check console for JavaScript errors
3. Verify PR counts load correctly
4. Test with multiple organizations

### GitHub Actions Workflow
- **File:** `.github/workflows/deploy.yml`
- **Runs on:** Push to `master`, manual trigger
- **Steps:** Checkout → Create build-info.json → Deploy to Pages
- **No tests:** This is a simple static site with no test suite

### Known Issues
- **No linting:** No ESLint, Prettier, or similar tools configured
- **No tests:** No Jest, Mocha, or similar test framework
- **Inline styles:** HTML contains inline styles (intentional for simplicity)

## Important Implementation Details

### Async Update Pattern
**Always use setTimeout, never setInterval** for periodic updates:
```javascript
// CORRECT (current implementation)
self.update(function onComplete() {
  setTimeout(self.update, 300000); // 5 minutes
});

// WRONG (old pattern)
setInterval(self.update, 60000); // Can cause concurrent updates
```

### SaveCache Must Merge
`saveCache()` MUST load existing cache and merge, not replace:
```javascript
// Load existing cache first
var existingCache = JSON.parse(localStorage.getItem(cacheKey) || '{}');
var projects = existingCache.projects || {};
// Then merge new PRs into projects
```

### Body CSS Class for Status
The `<body>` tag gets `disaster` class when data is incomplete (red background):
```html
<body data-bind="with: searchResults, css: { disaster: !isDataComplete() }">
```

### PR Reconstruction
When loading from cache, PRs must be reconstructed with all fields:
```javascript
reconstructPR(projectName, prNumber, minimalPR) {
  return {
    id: projectName + '#' + prNumber,
    number: prNumber,
    created_at: minimalPR.created_at,
    closed_at: minimalPR.closed_at,
    repository_url: 'https://api.github.com/repos/' + projectName,
    html_url: 'https://github.com/' + projectName + '/pull/' + prNumber
  };
}
```

## Recent History Management
`index.html` maintains last 10 viewed organizations in `localStorage['recentOrgs']`:
- Updated after successful API fetch (not on page load)
- Validates org exists before adding to history
- Each org rendered with remove button (× icon)

## Files That Should Not Be Edited
- `credentials.js` - Gitignored, user-specific
- `.DS_Store` - Mac filesystem metadata
- `images/` - Static assets (backgrounds, jamie images for score visualization)

## When Making Changes

### Always:
- Test in browser after changes
- Check browser console for errors
- Verify localStorage cache works correctly
- Test with both authenticated and anonymous modes

### Never:
- Add build tools without updating deployment workflow
- Change cache structure without considering existing user data
- Use `setInterval` for periodic updates (breaks concurrent update handling)
- Store full PR objects in cache (storage limit is ~5-10MB)

## Trust These Instructions
These instructions are comprehensive and validated. Only search the codebase if:
1. Instructions contradict observed behavior
2. Adding features not covered here
3. Debugging unexpected errors

For routine changes to existing features, follow the patterns described above.
