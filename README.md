# GitHub Dashboard

A client-side web application for visualizing GitHub pull request statistics across organizations. Built as a pure static site with no backend or build process, this dashboard provides real-time insights into PR metrics, trends, and team performance.

![GitHub Pages](https://img.shields.io/badge/Deployed%20on-GitHub%20Pages-blue)
![No Build Required](https://img.shields.io/badge/Build%20Process-None-green)

## Features

### Core Functionality

- **Organization PR Statistics**: View comprehensive pull request data for any GitHub organization
- **Real-time Updates**: Automatically refreshes data every 5 minutes with manual refresh option
- **Visual Analytics**: Interactive charts showing PR trends and distributions using Chart.js
- **Multi-Organization Support**: Easily switch between different organizations via URL parameters

### Data Management

- **Smart Caching**: Hierarchical localStorage caching system minimizes API calls and provides instant page loads
- **Progressive Loading**: Data displays immediately from cache while fetching updates in the background
- **Auth-Aware Caching**: Separate caches for authenticated and anonymous sessions
- **Data Completeness Indicators**: Visual warnings when GitHub API limits prevent full data retrieval (1000 PR limit)

### User Interface

- **Recent Organizations**: Automatically tracks your last 10 viewed organizations for quick access
- **Organization Selector**: Simple form-based interface for entering new organizations
- **Data Freshness Display**: Shows last update timestamp and cache status
- **Responsive Design**: Bootstrap 3-based UI that works across devices

### Deployment Options

- **GitHub Pages**: Automatic deployment on push to master branch
- **Raspberry Pi Kiosk Mode**: Includes configuration for fullscreen dashboard display on Raspberry Pi (LXDE)

## Quick Start

### Running Locally

No installation or build process required. Simply serve the static files:

```bash
# Using Python (recommended)
python3 -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000/index.html` in your browser.

### Viewing Organizations

1. Open the dashboard (either locally or at your GitHub Pages URL)
2. Enter an organization name in the form
3. View the pull request statistics and charts

To view a specific organization directly, use: `OpenPRs.html?org=<organization-name>`

## Authentication (Optional)

The dashboard works without authentication but only shows public repositories. For private repository access:

### Modern Method (Recommended)

Store your GitHub Personal Access Token in localStorage:

1. Open browser DevTools Console (F12)
2. Run: `localStorage.setItem('github-token', 'your_token_here')`
3. Refresh the page

### Legacy Method

Alternatively, use the credentials file:

1. Copy `credentials.sample.js` to `credentials.js`
2. Set the `username` to your GitHub username
3. Set the `accessCode` to a [GitHub Personal Access Token](https://github.com/settings/tokens) with repo permissions

**Note:** The `credentials.js` file is gitignored for security.

## Configuration

### Default Organization

The default organization is `NathanJPhillips`. To change it, edit the constructor in `SearchResults.js`.

### Refresh Interval

Auto-refresh runs every 300 seconds (5 minutes). Modify the timeout value in `SearchResults.js` to change this.

### Recent Organizations Limit

The dashboard tracks the last 10 organizations. Adjust `maxRecentOrgs` in `index.html` to change this limit.

## Technical Details

### Technology Stack

- **Frontend**: Vanilla JavaScript (ES5), HTML5, CSS3
- **Libraries**:
  - Knockout.js 3.4.1 (MVVM data binding)
  - jQuery 3.1.1 (AJAX)
  - Chart.js (visualizations via knockout-chart-binding)
  - Bootstrap 3.3.7 (UI framework)
  - Lodash (utilities)
- **API**: GitHub REST API v3
- **Storage**: Browser localStorage (~5-10MB limit)
- **Deployment**: GitHub Actions → GitHub Pages

### Architecture

- Pure client-side SPA (Single Page Application)
- No build process, bundler, or transpilation
- Hierarchical cache structure: `projects[repo].prs[prNumber]`
- Progressive data loading with 100 PRs per API page
- Minimal field storage (only `created_at` and `closed_at` per PR)

### GitHub API Considerations

- Search API has a hard limit of 1000 results
- Pagination provides 100 results per page
- Rate limits: 60 requests/hour (unauthenticated), 5000 requests/hour (authenticated)
- The dashboard indicates when data is incomplete due to the limits and will catch up on subsequent refreshes

## Deployment

### GitHub Pages (Automatic)

The repository includes a GitHub Actions workflow that automatically deploys to GitHub Pages:

1. Push changes to the `master` branch
2. GitHub Actions runs the deployment workflow
3. Site updates at `https://<username>.github.io/github-dashboard/`

No build step is involved—static files are deployed as-is.

### Raspberry Pi Kiosk Mode

For running as a fullscreen dashboard on Raspberry Pi:

1. Run the `install` script to set up autostart
2. The `github-dashboard` script handles automatic updates and browser launch
3. Configured for LXDE desktop environment

## Browser Compatibility

Tested and working on:

- Chrome/Chromium 90+

Assumed compatibility with:

- Firefox 88+
- Safari 14+
- Edge 90+

**Note:** Requires localStorage support and ES5 JavaScript compatibility.

## Development

### Making Changes

1. Edit HTML/CSS/JS files directly
2. Refresh browser to see changes
3. Check browser console for errors
4. Test localStorage cache in DevTools → Application tab
5. Push to master for automatic deployment

### Debugging

```javascript
// View current cache in console
JSON.parse(localStorage.getItem('pr-cache-<org>-anon'))

// Count cached PRs
Object.keys(localStorage).filter(k => k.startsWith('pr-cache-')).map(k => {
  const data = JSON.parse(localStorage[k]);
  const prCount = Object.values(data.projects || {}).reduce((sum, p) => 
    sum + Object.keys(p.prs || {}).length, 0);
  return { org: k, prs: prCount };
})

// Clear cache for testing
localStorage.clear()
```

## Contributing

This is a personal project, but suggestions and improvements are welcome. The codebase is intentionally kept simple with no build process to minimize maintenance overhead.

## License

This project is provided as-is for educational and personal use.

## Credits

Originally created for tracking Diffblue organization statistics, now generalized for any GitHub organization.
