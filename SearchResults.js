function average(collection) { return _.sum(collection) / collection.length; }


function PullRequest(data) {
  var self = this;
  if (!data)
    console.log("Created PullRequest with no data");
  ko.mapping.fromJS(data, {}, self);

  self.createdAt = ko.pureComputed(function () { return new Date(self.created_at()); });
  self.updatedAt = ko.pureComputed(function () { return new Date(self.updated_at()); });
  self.isOpen = ko.pureComputed(function () { return self.closed_at() == null; });
  self.closedAt = ko.pureComputed(function () { return self.isOpen() ? null : new Date(self.closed_at()); });
  self.age = ko.pureComputed(function () { return (self.isOpen() ? new Date() : self.closedAt()) - self.createdAt(); });

  self.isOpenAtDate = function (when) {
    return self.createdAt() <= when && (self.isOpen() || self.closedAt() > when);
  };
}

var msInADay = 1000 * 60 * 60 * 24,
  msInAWeek = msInADay * 7,
  msInAYear = msInADay * 365.25;

function SearchResults(org) {
  var self = this;

  // Helper: Get GitHub token from localStorage
  function getGitHubToken() {
    return localStorage.getItem('github-token') || '';
  }

  // Helper: Get auth key suffix (first 5 chars of token)
  function getAuthKey() {
    var token = getGitHubToken();
    return token ? token.substring(0, 5) : 'anon';
  }

  // Helper: Extract project name from repository_url or html_url
  // e.g., "https://api.github.com/repos/owner/repo" -> "owner/repo"
  function getProjectName(pr) {
    var url = pr.repository_url || pr.html_url || '';
    var match = url.match(/\/repos\/([^\/]+\/[^\/]+)/);
    return match ? match[1] : 'unknown';
  }

  // Helper: Extract minimal fields we need from a PR
  function extractPRFields(pr) {
    return {
      created_at: pr.created_at,
      closed_at: pr.closed_at
    };
  }

  // Helper: Reconstruct full PR object from cache
  function reconstructPR(projectName, prNumber, minimalPR) {
    return {
      id: projectName + '#' + prNumber, // Synthetic ID for knockout mapping
      number: prNumber,
      created_at: minimalPR.created_at,
      updated_at: null, // Not stored per-PR
      closed_at: minimalPR.closed_at,
      repository_url: 'https://api.github.com/repos/' + projectName,
      html_url: 'https://github.com/' + projectName + '/pull/' + prNumber
    };
  }

  var cacheKey = 'pr-cache-' + org + '-' + getAuthKey();

  self.lastUpdateTimestamp = ko.observable();
  self.isDataComplete = ko.observable(false);

  self.pullRequests =
    ko.mapping.fromJS([],
      {
        key: function (data) { return data ? ko.utils.unwrapObservable(data.id) : null; },
        create: function (options) { return new PullRequest(options.data); }
      });
  self.openPullRequests = ko.pureComputed(function () {
    return self.pullRequests().filter(function (pr) { return pr.isOpen(); });
  });
  self.closedPullRequests = ko.pureComputed(function () {
    return self.pullRequests().filter(function (pr) { return !pr.isOpen(); });
  });
  self.openPRsAtDate = function(when) {
    return self.pullRequests().filter(function (pr) { return pr.isOpenAtDate(when); });
  };
  self.pullRequestAges = function (open) {
    return (open ? self.openPullRequests() : self.closedPullRequests()).map(function (pr) { return pr.age(); });
  };
  self.averagePRAge = function (open) {
    return ko.pureComputed(function () { return average(self.pullRequestAges(open)); });
  };
  self.minPRAge = function (open) {
    return ko.pureComputed(function () { return _.min(self.pullRequestAges(open)); });
  };
  self.maxPRAge = function (open) {
    return ko.pureComputed(function () { return _.max(self.pullRequestAges(open)); });
  };
  self.agesOfPRsOpenAt = function (when) {
    return self.openPRsAtDate(when).map(function (pr) { return when - pr.createdAt(); });
  };
  self.lastPRUpdate = ko.observable();

  self.prCountByAgeInWeeks = function (open, limit) {
    var map = new Array();
    self.pullRequestAges(open)
      .forEach(function (age) {
        var weeks = Math.floor(age / msInAWeek);
        map[weeks] = (map[weeks] ? map[weeks] : 0) + 1;
      });
    var cumulative = [];
    _.range(limit, 0 , -1).reduce(function (c, i) {
      var count = c + (map[i] ? map[i] : 0);
      cumulative.push(count);
      return count;
    }, 0);
    return _.reverse(cumulative);
    // Non-cumulative version
    //return _.range(limit).map(function (weeks) { return map[weeks] ? map[weeks] : 0; });
  };


  function createHistory(f, limit) {
    var dates = [];
    var openPRCountHistory = [];
    var when = new Date();
    for (var count = 0; count < limit; ++count) {
      dates.push(new Date(when).toLocaleDateString());
      openPRCountHistory.push(f(when));
      when -= msInADay;
    }
    return { labels: dates.reverse(), data: openPRCountHistory.reverse() };
  };
  self.openPRCountHistory = function (limit) {
    return createHistory(function (when) { return self.openPRsAtDate(when).length; }, limit);
  };
  self.sumOfPRAgesHistory = function (limit) {
    return createHistory(function (when) { return _.sum(self.agesOfPRsOpenAt(when)) / msInAYear; }, limit);
  };
  self.sumOfPRAges = ko.pureComputed(function () { return _.sum(self.agesOfPRsOpenAt(new Date())); });
  self.jamiesDisapproval = ko.pureComputed(function() { return Math.round(Math.log(1 + self.sumOfPRAges() / 263000000)); });

  self.errorMessage = ko.observable();
  self.errorMessage.subscribe(function(newValue) {
    if (newValue != null)
      console.log(newValue);
  });
  self.activeRequests = ko.observable(0);
  self.loading = ko.pureComputed(function () { self.activeRequests() == 0; });
  self.uninitialised = ko.pureComputed(function () { return self.pullRequests().length == 0; });


  // Save cache to localStorage with project hierarchy
  function saveCache(prs, isComplete) {
    try {
      // Load existing cache to merge with
      var existingCache = {};
      try {
        var cached = localStorage.getItem(cacheKey);
        if (cached) {
          var data = JSON.parse(cached);
          existingCache = data.projects || {};
        }
      } catch (e) {
        console.warn('Failed to load existing cache for merge:', e);
      }

      // Organize PRs by project, merging with existing cache
      var projects = existingCache;
      var maxUpdateTime = null;

      prs.forEach(function(pr) {
        var projectName = getProjectName(pr);
        if (!projects[projectName]) {
          projects[projectName] = { prs: {} };
        }

        var minimalPR = extractPRFields(pr);
        projects[projectName].prs[pr.number] = minimalPR;

        // Track highest update time
        var updateTime = new Date(pr.updated_at);
        if (!maxUpdateTime || updateTime > maxUpdateTime) {
          maxUpdateTime = updateTime;
        }
      });

      // If complete, use current time; otherwise use highest PR update time
      var lastPRUpdate = isComplete ? new Date().toISOString() :
                         (maxUpdateTime ? maxUpdateTime.toISOString() : null);

      localStorage.setItem(cacheKey, JSON.stringify({
        projects: projects,
        lastPRUpdate: lastPRUpdate,
        isComplete: isComplete || false,
        timestamp: new Date().toISOString()
      }));

      self.lastUpdateTimestamp(lastPRUpdate);
      self.isDataComplete(isComplete || false);

    } catch (e) {
      console.warn('Failed to save cache to localStorage:', e);
    }
  }

  // Load cache from localStorage and convert back to flat array
  function loadCache() {
    try {
      var cached = localStorage.getItem(cacheKey);
      if (cached) {
        var data = JSON.parse(cached);

        // Convert projects hierarchy back to flat array, reconstructing full PR objects
        var pullRequests = [];
        Object.keys(data.projects || {}).forEach(function(projectName) {
          var project = data.projects[projectName];
          Object.keys(project.prs || {}).forEach(function(prNumber) {
            var minimalPR = project.prs[prNumber];
            pullRequests.push(reconstructPR(projectName, prNumber, minimalPR));
          });
        });

        console.log('Loaded cache from', data.timestamp, '(' + pullRequests.length + ' PRs across ' +
                    Object.keys(data.projects || {}).length + ' projects)');

        self.lastUpdateTimestamp(data.lastPRUpdate);
        self.isDataComplete(data.isComplete || false);

        return {
          pullRequests: pullRequests,
          lastPRUpdate: data.lastPRUpdate,
          isComplete: data.isComplete
        };
      }
    } catch (e) {
      console.warn('Failed to load cache from localStorage:', e);
    }
    return null;
  }

  function loadAllPages(query, onComplete, onFirstSuccess) {
    var totalCount;
    var pullRequests = [];
    var firstRequestSucceeded = false;
    // Function to load a page of results
    function getPage(uri) {
      self.activeRequests(self.activeRequests() + 1);
      $.getJSON(uri, function (data, textStatus, jqXHR) {
        self.errorMessage(null);
        totalCount = data.total_count;
        // Call onFirstSuccess callback after first successful request
        if (!firstRequestSucceeded && onFirstSuccess) {
          firstRequestSucceeded = true;
          onFirstSuccess();
        }
        // Add the pull requests to the existing cache
        pullRequests = pullRequests.concat(data.items);

        // Get the link to the next page of results
        var nextLinkSuffix = "; rel=\"next\"";
        var linksHeader = jqXHR.getResponseHeader("Link");
        if (linksHeader == null)
          linksHeader = "";
        var nextLinks = linksHeader.split(",").filter(function (link) { return link.endsWith(nextLinkSuffix); });
        var hasMorePages = nextLinks.length > 0;

        // Determine if data is complete:
        // - If there are more pages, definitely incomplete
        // - If no more pages BUT we hit GitHub's 1000 result limit, incomplete
        // - Only complete if no more pages AND last page had fewer results (indicating we got everything)
        var hitSearchLimit = pullRequests.length >= 1000;
        var isComplete = !hasMorePages && (!hitSearchLimit || data.items.length < 100);

        // Save progress after each page
        saveCache(pullRequests, isComplete);

        if (hasMorePages) {
          var nextLink = nextLinks[0];
          // Extract URL from <URL>; rel="next" format
          var match = nextLink.match(/<([^>]+)>/);
          if (match) {
            getPage(match[1]);
          }
        } else if (onComplete) {
          onComplete(pullRequests, totalCount);
        }
      })
      .fail(function (jqXHR, textStatus, errorThrown) {
        if (jqXHR.status === 0) {
          self.errorMessage("Could not connect to Github");
          return;
        }
        var rateLimitRemaining = jqXHR.getResponseHeader("X-RateLimit-Remaining");
        if (rateLimitRemaining !== null && rateLimitRemaining <= 0) {
          var rateLimitReset = new Date(parseInt(jqXHR.getResponseHeader("X-RateLimit-Reset")) * 1000 + 1000);
          self.errorMessage("Rate limit exceeded, retrying at " + rateLimitReset.toLocaleTimeString());
          setTimeout(function () { getPage(uri); }, rateLimitReset - new Date());
          return;
        }
        self.errorMessage("Failure response from Github: " + jqXHR.statusText);
      })
      .always(function () { self.activeRequests(self.activeRequests() - 1); });
    }
    getPage("https://api.github.com/search/issues?q=" + encodeURIComponent(query) + "&sort=updated&order=asc&per_page=100");
  }

  var baseQuery = "user:" + org + " type:pr";

  function processSearchResults(pullRequestCache, onComplete) {
    // Don't retrieve more search results if already have as many as totalCount
    // We might have more than totalCount if we have retrieved PRs updated on the date of the overlaps between queries more than once
    var requestAgain = pullRequestCache.length < totalCount;
    if (pullRequestCache.length != 0) {
      // Check whether lastPRUpdate has progressed, if not there's no point in repeating the last query
      var newLastUpdate = new Date(pullRequestCache[pullRequestCache.length - 1].updated_at);
      if (!(newLastUpdate <= self.lastPRUpdate()))
        // Store the updated lastPRUpdate
        self.lastPRUpdate(newLastUpdate);
      else
        requestAgain = false;
    } else
      requestAgain = false;
    if (requestAgain) {
      loadAllPages(baseQuery + " updated:>=" + dateToGitHubISOString(self.lastPRUpdate()), function (prs) {
        processSearchResults(pullRequestCache.concat(prs), onComplete);
      });
      return;
    }
    if (self.uninitialised())
      ko.mapping.fromJS(pullRequestCache, {}, self.pullRequests);
    else {
      // Add the pull requests to the array - this is very slow
      for (let pr of pullRequestCache) {
        var prIndex = self.pullRequests.mappedIndexOf(pr);
        if (prIndex === -1)
          self.pullRequests.mappedCreate(pr);
        else
          ko.mapping.fromJS(pr, {}, self.pullRequests[prIndex]);
      }
    }
    console.log("Retrieved " + pullRequestCache.length + " pull requests, making a total of " + self.pullRequests().length + " at " + new Date());
    if (onComplete)
      onComplete();
  }

  var totalCount;
  var updateTimeoutId = null;

  self.update = function (onComplete, onFirstSuccess) {
    // Build query - if lastPRUpdate is set, only fetch updates since then
    var query = baseQuery;
    if (self.lastPRUpdate()) {
      query = baseQuery + " updated:>=" + dateToGitHubISOString(self.lastPRUpdate());
    }

    loadAllPages(query, function (prs, count) {
      totalCount = count;
      processSearchResults(prs, function() {
        // Note: saveCache is already called in loadAllPages after each page
        // Mark as complete after full update cycle
        var allPRs = self.pullRequests().map(function(pr) { return ko.mapping.toJS(pr); });
        saveCache(allPRs, true);

        if (onComplete) onComplete();
      });
    }, onFirstSuccess);
  };

  self.scheduleNextUpdate = function() {
    // Clear any existing timeout
    if (updateTimeoutId) {
      clearTimeout(updateTimeoutId);
    }
    // Schedule next update in 5 minutes (300 seconds)
    updateTimeoutId = setTimeout(function() {
      self.update(self.scheduleNextUpdate);
    }, 300 * 1000);
  };

  self.refreshNow = function() {
    // Cancel scheduled update and run immediately
    if (updateTimeoutId) {
      clearTimeout(updateTimeoutId);
      updateTimeoutId = null;
    }
    self.update(self.scheduleNextUpdate);
  };

  self.load = function (onFirstSuccess) {
    // Try to load from cache first
    var cached = loadCache();
    if (cached && cached.pullRequests.length > 0) {
      // Load cached data into the UI immediately
      ko.mapping.fromJS(cached.pullRequests, {}, self.pullRequests);
      if (cached.lastPRUpdate) {
        self.lastPRUpdate(new Date(cached.lastPRUpdate));
      }
      console.log('Loaded ' + cached.pullRequests.length + ' PRs from cache');
    }

    // Fetch new data (everything if no cache, or updates if we have cache)
    self.update(self.scheduleNextUpdate, onFirstSuccess);
  };
}
