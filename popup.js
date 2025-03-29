document.addEventListener('DOMContentLoaded', () => {
    const upcomingButton = document.getElementById('upcoming');
    const liveButton = document.getElementById('live');
    const resultsButton = document.getElementById('results');
    const matchListDiv = document.getElementById('match-list');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('i');
    const tournamentFiltersDiv = document.getElementById('tournament-filters');
    const dropdownHeader = document.getElementById('dropdown-header');
    const dropdownContainer = document.querySelector('.dropdown-container');
    const selectedText = document.querySelector('.selected-text');
  
    const proxyUrl = 'https://valorant-proxy.vercel.app/api/proxy';
    const notificationApiUrl = 'https://valorant-proxy.vercel.app/api/notification';
    let userId = null;
    let currentMatches = [];
    let selectedTournaments = new Set();
    let teamLogos = new Map();
    let tournamentIcons = new Map();

    // Load team logos and tournament icons
    async function loadInitialData() {
      try {
        // Load team logos
        const teamData = await fetch(chrome.runtime.getURL('team_logos.json')).then(response => response.json());
        teamData.forEach(team => {
          teamLogos.set(team.team_name, team.logo_url);
        });

        // Load tournament icons directly from proxy
        const iconResponse = await fetch('https://valorant-proxy.vercel.app/api/proxy?q=tournament_icons');
        if (!iconResponse.ok) {
          throw new Error(`HTTP error! status: ${iconResponse.status}`);
        }
        const iconData = await iconResponse.json();
        
        if (iconData.icons) {
          iconData.icons.forEach(icon => {
            if (icon.name && icon.url) {
              tournamentIcons.set(icon.name, icon.url);
            }
          });
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    }

    // Generate a unique user ID or retrieve the existing one
    function getUserId() {
      return new Promise((resolve) => {
        chrome.storage.local.get('userId', (data) => {
          if (data.userId) {
            resolve(data.userId);
          } else {
            // Generate a unique ID
            const newUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            chrome.storage.local.set({ userId: newUserId }, () => {
              resolve(newUserId);
            });
          }
        });
      });
    }

    // Function to save notifications to the API
    async function saveNotificationsToApi(notifiedMatches) {
      try {
        const response = await fetch(notificationApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId,
            notifiedMatches
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error saving notifications to API:', error);
        return { error: error.message };
      }
    }

    // Function to fetch notifications from the API
    async function fetchNotificationsFromApi() {
      try {
        const response = await fetch(`${notificationApiUrl}?userId=${userId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.notifiedMatches || {};
      } catch (error) {
        console.error('Error fetching notifications from API:', error);
        return {};
      }
    }

    // Function to delete a notification from the API
    async function deleteNotificationFromApi(matchId) {
      try {
        const response = await fetch(notificationApiUrl, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId,
            matchId
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error deleting notification from API:', error);
        return { error: error.message };
      }
    }

    // Modified preloadNotificationStates function - only fetches from API
    async function preloadNotificationStates() {
      try {
        // First get user ID
        userId = await getUserId();
        console.log('User ID:', userId);
        
        // Only fetch notifications from API - no local storage
        const apiNotifications = await fetchNotificationsFromApi();
        console.log('Fetched notifications from API:', apiNotifications);
        
        return apiNotifications;
      } catch (error) {
        console.error('Error preloading notification states:', error);
        return {};
      }
    }

    // Add a function to refresh notification states from API
    async function refreshNotificationStates() {
      try {
        if (!userId) {
          userId = await getUserId();
        }
        const apiNotifications = await fetchNotificationsFromApi();
        console.log('Refreshed notification states from API:', apiNotifications);
        
        // If we're on the upcoming tab, update the UI
        if (currentQuery === 'upcoming') {
          // Delay slightly to ensure DOM is ready
          setTimeout(() => updateNotificationUI(), 100);
        }
        
        return apiNotifications;
      } catch (error) {
        console.error('Error refreshing notification states:', error);
        return {};
      }
    }

    // Call loadInitialData when popup opens
    loadInitialData().then(async () => {
      await preloadNotificationStates();
      
      // Add test button in development mode
      const testButton = document.createElement('button');
      testButton.textContent = 'Test Notification';
      testButton.classList.add('test-button');
      testButton.addEventListener('click', () => {
        const testMatch = {
          team1: "Test Team 1",
          team2: "Test Team 2",
          tournament_name: "Test Tournament",
          unix_timestamp: new Date(Date.now() + 6 * 60 * 1000).toISOString(), // 6 minutes from now
          match_page: "https://www.vlr.gg",
          id: `test-match-${Date.now()}`
        };
        
        console.log('Created test match:', testMatch);
        const matchElement = createMatchElement(testMatch, 'upcoming');
        matchListDiv.insertBefore(matchElement, matchListDiv.firstChild);
      });
      
      document.querySelector('.header-right').appendChild(testButton);
      
      fetchMatchesViaProxy('live');
    });

    // Function to get team logo
    function getTeamLogo(teamName) {
      return teamLogos.get(teamName) || 'https://www.vlr.gg/img/vlr/tmp/vlr.png';
    }

    // Function to get tournament icon
    function getTournamentIcon(tournamentName) {
      return tournamentIcons.get(tournamentName) || null;
    }

    // Function to save tournament icons
    async function saveTournamentIcons() {
      try {
        // Convert Map to array for API
        const icons = Array.from(tournamentIcons.entries()).map(([name, url]) => ({
          name,
          url
        }));
        
        // Save to API
        const response = await fetch('https://valorant-proxy.vercel.app/api/tournament-icons', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ icons })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('Tournament icons saved successfully to API');
      } catch (error) {
        console.error('Error saving tournament icons to API:', error);
      }
    }

    // Function to update tournament icons from results
    function updateTournamentIcons(data) {
      if (data.tournament_icons) {
        data.tournament_icons.forEach(icon => {
          if (icon.name && icon.url) {
            tournamentIcons.set(icon.name, icon.url);
          }
        });
      }
    }

    // Theme handling
    function setTheme(theme) {
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
      const currentTheme = document.body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });

    // Dropdown handling
    dropdownHeader.addEventListener('click', () => {
      dropdownContainer.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdownContainer.contains(e.target)) {
        dropdownContainer.classList.remove('active');
      }
    });

    // Tournament filter handling
    function updateTournamentFilters(matches) {
      const tournaments = new Map();
      const categories = new Map();
      
      // First pass: collect all tournaments and categorize them
      matches.forEach(match => {
        const tournamentName = match.tournament_name || match.match_event;
        if (tournamentName && !tournaments.has(tournamentName)) {
          tournaments.set(tournamentName, {
            name: tournamentName,
            icon: match.tournament_icon
          });

          // Categorize tournaments
          const lowerName = tournamentName.toLowerCase();
          
          // Champions Tour
          if (lowerName.includes('champions tour')) {
            if (!categories.has('Champions Tour')) {
              categories.set('Champions Tour', {
                name: 'Champions Tour',
                tournaments: new Set(),
                icon: match.tournament_icon
              });
            }
            categories.get('Champions Tour').tournaments.add(tournamentName);
          }
          // VCT
          else if (lowerName.includes('vct')) {
            if (!categories.has('VCT')) {
              categories.set('VCT', {
                name: 'VCT',
                tournaments: new Set(),
                icon: match.tournament_icon
              });
            }
            categories.get('VCT').tournaments.add(tournamentName);
          }
          // Game Changers
          else if (lowerName.includes('game changers')) {
            if (!categories.has('Game Changers')) {
              categories.set('Game Changers', {
                name: 'Game Changers',
                tournaments: new Set(),
                icon: match.tournament_icon
              });
            }
            categories.get('Game Changers').tournaments.add(tournamentName);
          }
          // Challengers League (all types)
          else if (lowerName.includes('challengers league') || 
                   lowerName.includes('wdg challengers') || 
                   lowerName.includes('gamers club challengers') ||
                   lowerName.includes('challengers')) {
            if (!categories.has('Challengers League')) {
              categories.set('Challengers League', {
                name: 'Challengers League',
                tournaments: new Set(),
                icon: match.tournament_icon
              });
            }
            categories.get('Challengers League').tournaments.add(tournamentName);
          }
          // Regional Leagues
          else if (lowerName.includes('league')) {
            // Extract region from tournament name
            let region = '';
            if (lowerName.includes('north america')) region = 'North America';
            else if (lowerName.includes('emea')) region = 'EMEA';
            else if (lowerName.includes('pacific')) region = 'Pacific';
            else if (lowerName.includes('china')) region = 'China';
            else if (lowerName.includes('korea')) region = 'Korea';
            else if (lowerName.includes('japan')) region = 'Japan';
            else if (lowerName.includes('brazil')) region = 'Brazil';
            else if (lowerName.includes('latam')) {
              if (lowerName.includes('north')) region = 'LATAM North';
              else if (lowerName.includes('south')) region = 'LATAM South';
              else region = 'LATAM';
            }
            else if (lowerName.includes('france')) region = 'France';
            else if (lowerName.includes('spain')) region = 'Spain';
            else if (lowerName.includes('türkiye') || lowerName.includes('turkiye')) region = 'Türkiye';
            
            const categoryName = region ? `Regional League ${region}` : 'Regional League';
            if (!categories.has(categoryName)) {
              categories.set(categoryName, {
                name: categoryName,
                tournaments: new Set(),
                icon: match.tournament_icon
              });
            }
            categories.get(categoryName).tournaments.add(tournamentName);
          }
          // Academy Tournaments
          else if (lowerName.includes('academy')) {
            if (!categories.has('Academy Tournaments')) {
              categories.set('Academy Tournaments', {
                name: 'Academy Tournaments',
                tournaments: new Set(),
                icon: match.tournament_icon
              });
            }
            categories.get('Academy Tournaments').tournaments.add(tournamentName);
          }
          // Qualifiers
          else if (lowerName.includes('qualifier') || lowerName.includes('qualification')) {
            if (!categories.has('Qualifiers')) {
              categories.set('Qualifiers', {
                name: 'Qualifiers',
                tournaments: new Set(),
                icon: match.tournament_icon
              });
            }
            categories.get('Qualifiers').tournaments.add(tournamentName);
          }
          // Showmatches
          else if (lowerName.includes('showmatch')) {
            if (!categories.has('Showmatches')) {
              categories.set('Showmatches', {
                name: 'Showmatches',
                tournaments: new Set(),
                icon: match.tournament_icon
              });
            }
            categories.get('Showmatches').tournaments.add(tournamentName);
          }
          // Other Tournaments
          else {
            if (!categories.has('Other Tournaments')) {
              categories.set('Other Tournaments', {
                name: 'Other Tournaments',
                tournaments: new Set(),
                icon: match.tournament_icon
              });
            }
            categories.get('Other Tournaments').tournaments.add(tournamentName);
          }
        }
      });

      tournamentFiltersDiv.innerHTML = '';
      
      // Add "All" filter
      const allFilter = document.createElement('div');
      allFilter.classList.add('dropdown-item');
      allFilter.setAttribute('data-value', 'all');
      allFilter.innerHTML = `
        <span>All Tournaments</span>
        <i class="fas fa-check"></i>
      `;
      allFilter.addEventListener('click', () => {
        selectedTournaments.clear();
        document.querySelectorAll('.dropdown-item').forEach(item => {
          item.classList.remove('active');
        });
        allFilter.classList.add('active');
        selectedText.textContent = 'All Tournaments';
        filterMatches();
      });
      tournamentFiltersDiv.appendChild(allFilter);

      // Sort categories by priority
      const categoryOrder = [
        'Champions Tour',
        'VCT',
        'Game Changers',
        'Challengers League',
        'Regional League EMEA',
        'Regional League North America',
        'Regional League Pacific',
        'Regional League China',
        'Regional League Korea',
        'Regional League Japan',
        'Regional League Brazil',
        'Regional League LATAM North',
        'Regional League LATAM South',
        'Regional League France',
        'Regional League Spain',
        'Regional League Türkiye',
        'Regional League',
        'Academy Tournaments',
        'Qualifiers',
        'Showmatches',
        'Other Tournaments'
      ];

      // Add category filters in sorted order
      categoryOrder.forEach(categoryName => {
        const category = categories.get(categoryName);
        if (category) {
          const filter = createFilterItem(category.name, true, category);
          
          filter.setAttribute('data-value', category.name);
          filter.setAttribute('data-tournaments', Array.from(category.tournaments).join(','));
          
          filter.addEventListener('click', () => {
            const isActive = filter.classList.contains('active');
            
            // Toggle all tournaments in this category
            category.tournaments.forEach(tournamentName => {
              if (isActive) {
                selectedTournaments.delete(tournamentName);
              } else {
                selectedTournaments.add(tournamentName);
              }
            });
            
            // Update UI
            filter.classList.toggle('active');
            allFilter.classList.remove('active');
            
            // Update selected text
            if (selectedTournaments.size === 0) {
              selectedText.textContent = 'All Tournaments';
              allFilter.classList.add('active');
            } else if (selectedTournaments.size === 1) {
              selectedText.textContent = Array.from(selectedTournaments)[0];
            } else {
              selectedText.textContent = `${selectedTournaments.size} tournaments selected`;
            }
            
            filterMatches();
          });
          
          tournamentFiltersDiv.appendChild(filter);
        }
      });

      // Add a divider
      const divider = document.createElement('div');
      divider.classList.add('dropdown-divider');
      divider.innerHTML = '<span>Individual Tournaments</span>';
      tournamentFiltersDiv.appendChild(divider);

      // Add individual tournament filters (sorted alphabetically)
      Array.from(tournaments.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([tournamentName, tournament]) => {
          const filter = createFilterItem(tournamentName);
          
          filter.setAttribute('data-value', tournamentName);
          
          filter.addEventListener('click', () => {
            if (selectedTournaments.has(tournamentName)) {
              selectedTournaments.delete(tournamentName);
              filter.classList.remove('active');
            } else {
              selectedTournaments.add(tournamentName);
              filter.classList.add('active');
              allFilter.classList.remove('active');
            }
            
            // Update selected text
            if (selectedTournaments.size === 0) {
              selectedText.textContent = 'All Tournaments';
              allFilter.classList.add('active');
            } else if (selectedTournaments.size === 1) {
              selectedText.textContent = Array.from(selectedTournaments)[0];
            } else {
              selectedText.textContent = `${selectedTournaments.size} tournaments selected`;
            }
            
            filterMatches();
          });
          
          tournamentFiltersDiv.appendChild(filter);
        });

      // Select Champions Tour by default if available
      const championsTourCategory = categories.get('Champions Tour');
      if (championsTourCategory) {
        const championsTourFilter = tournamentFiltersDiv.querySelector('[data-value="Champions Tour"]');
        if (championsTourFilter) {
          championsTourFilter.classList.add('active');
          allFilter.classList.remove('active');
          championsTourCategory.tournaments.forEach(tournamentName => {
            selectedTournaments.add(tournamentName);
          });
          selectedText.textContent = 'Champions Tour';
          filterMatches();
        }
      } else {
        allFilter.classList.add('active');
        selectedText.textContent = 'All Tournaments';
      }
    }

    function filterMatches() {
      const filteredMatches = selectedTournaments.size === 0 
        ? currentMatches 
        : currentMatches.filter(match => 
            selectedTournaments.has(match.tournament_name || match.match_event)
          );

      if (currentQuery === 'results') {
        displayResults(filteredMatches);
      } else if (currentQuery === 'live') {
        displayLiveMatches(filteredMatches);
      } else {
        displayUpcomingMatches(filteredMatches);
      }
    }

    let currentQuery = 'live';
  
    async function fetchMatchesViaProxy(query) {
      showLoadingState();
      try {
        const apiQuery = query === 'live' ? 'live_score' : query;
        const response = await fetch(`${proxyUrl}?q=${apiQuery}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        currentMatches = data.data.segments;
        currentQuery = query;
    
        // Update tournament icons if they're in the response
        if (data.tournament_icons) {
          updateTournamentIcons(data);
          // Save the updated icons to cache
          await saveTournamentIcons();
        }
        
        // Ensure all tournament icons are loaded before displaying
        await Promise.all(currentMatches.map(async match => {
          const tournamentName = match.tournament_name || match.match_event;
          if (tournamentName && !tournamentIcons.has(tournamentName)) {
            // Try to load icon from API if not in cache
            try {
              const iconResponse = await fetch(`${proxyUrl}?q=tournament_icon&name=${encodeURIComponent(tournamentName)}`);
              if (iconResponse.ok) {
                const iconData = await iconResponse.json();
                if (iconData.url) {
                  tournamentIcons.set(tournamentName, iconData.url);
                }
              }
            } catch (error) {
              console.error('Error loading tournament icon:', error);
            }
          }
        }));
        
        // IMPORTANT: Don't clear notification selections when switching tabs
        // We're only clearing tournament filters, not notification settings
        selectedTournaments.clear();
        selectedText.textContent = 'All Tournaments';
        
        // Always refresh notifications from API when switching tabs
        const notifiedMatches = await refreshNotificationStates();
        console.log('Refreshed notification states when switching tabs:', notifiedMatches);
        
        updateTournamentFilters(currentMatches);
        filterMatches();
        
        // If we're on the upcoming tab, make sure to update UI
        if (query === 'upcoming' && notificationButtons.size > 0) {
          // Slight delay to ensure DOM is ready
          setTimeout(() => updateNotificationUI(), 100);
        }
      } catch (error) {
        matchListDiv.innerHTML = `<p class="error">Failed to load matches: ${error.message}</p>`;
      }
    }
    
    // Comment out or remove the existing color generation functions
    /*
    function generateColor() {
        const hue = Math.random() * 360;
        const saturation = 80 + Math.random() * 15;
        const lightness = 80 + Math.random() * 10;
        const opacity = 0.2 + Math.random() * 0.1;
        return `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`;
    }

    // Store colors for each tournament
    const tournamentColors = new Map();

    function getTournamentColor(tournamentName) {
        if (!tournamentName) return 'var(--card-bg)';
        if (!tournamentColors.has(tournamentName)) {
            tournamentColors.set(tournamentName, generateColor());
        }
        return tournamentColors.get(tournamentName);
    }
    */

    // Add new shine effect functions
    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    function generateConsistentColor(tournamentName) {
        const hash = hashString(tournamentName);
        const hue = hash % 360;
        return `rgba(${hue}, 70%, 50%, 0.05)`;
    }

    function getTournamentShineEffect(tournamentName) {
        if (!tournamentName) return '';
        
        const effects = [
            {
                pattern: /^Champions Tour.*(?:Americas|North America)/i,
                color: 'rgba(255,0,0,0.15)',  // Increased opacity for Americas (red)
                border: 'rgba(255,0,0,0.1)',
                animation: 'vctAmericasShine'
            },
            {
                pattern: /^Champions Tour.*Pacific/i,
                color: 'rgba(0,255,255,0.12)', // Increased opacity for Pacific (cyan)
                border: 'rgba(0,255,255,0.08)',
                animation: 'vctPacificShine'
            },
            {
                pattern: /^Champions Tour.*(?:EMEA|Europe)/i,
                color: 'rgba(255,70,85,0.15)', // Increased opacity for EMEA (red-pink)
                border: 'rgba(255,70,85,0.1)',
                animation: 'vctEMEAShine'
            },
            {
                pattern: /^Champions Tour.*China/i,
                color: 'rgba(255,40,40,0.15)', // Increased opacity for China (bright red)
                border: 'rgba(255,40,40,0.1)',
                animation: 'vctChinaShine'
            },
            {
                pattern: /^Challengers League/i,
                color: 'rgba(10,200,185,0.12)', // Increased opacity for Challengers (teal)
                border: 'rgba(10,200,185,0.08)',
                animation: 'challengersShine'
            },
            {
                pattern: /Game Changers/i,
                color: 'rgba(147,112,219,0.15)', // Increased opacity for Game Changers (purple)
                border: 'rgba(147,112,219,0.1)',
                animation: 'gameChangersShine'
            },
            {
                pattern: /Valorant Champions/i,
                color: 'rgba(255,215,0,0.15)', // Increased opacity for Champions (gold)
                border: 'rgba(255,215,0,0.1)',
                animation: 'championsShine'
            }
        ];

        // Check patterns in order
        for (const effect of effects) {
            if (effect.pattern.test(tournamentName)) {
                return `
                    background: linear-gradient(110deg, 
                        var(--card-bg) 0%, 
                        ${effect.color} 40%, 
                        var(--card-bg) 60%
                    );
                    background-size: 200% 100%;
                    animation: ${effect.animation} 3s linear infinite;
                    border: 1px solid ${effect.border};
                    box-shadow: 0 2px 12px ${effect.color};
                `;
            }
        }

        // Default shine effect for unmatched tournaments
        const hash = hashString(tournamentName);
        const hue = hash % 360;
        const color = `hsla(${hue}, 70%, 50%, 0.12)`;
        const border = `hsla(${hue}, 70%, 50%, 0.08)`;
        
        return `
            background: linear-gradient(110deg, 
                var(--card-bg) 0%, 
                ${color} 40%, 
                var(--card-bg) 60%
            );
            background-size: 200% 100%;
            animation: defaultShine 3s linear infinite;
            border: 1px solid ${border};
            box-shadow: 0 2px 12px ${color};
        `;
    }

    // Add this to your CSS file

    // Update the formatDateTime function to better handle date strings
    function formatDateTime(timestamp, options = {}) {
      if (!timestamp) return 'N/A';
      
      let date;
      
      // Convert date string to timestamp
      if (typeof timestamp === 'string') {
        if (timestamp.includes('-')) {
          // For date strings like "2025-03-30 00:00:00"
          date = new Date(timestamp.replace(' ', 'T') + 'Z'); // Add Z to make it UTC
        } else {
          date = new Date(parseInt(timestamp));
        }
      } else {
        date = new Date(timestamp);
      }
    
      // Default options for time only
      const defaultOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      };
    
      if (options.includeDate) {
        Object.assign(defaultOptions, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          second: '2-digit'
        });
      }
    
      try {
        const formatted = new Intl.DateTimeFormat('en-US', defaultOptions)
          .format(date)
          .replace(/am|pm/i, match => match.toUpperCase()) + ' IST';
        return formatted;
      } catch (error) {
        console.error('Error formatting date:', error, 'for timestamp:', timestamp);
        return 'Invalid date';
      }
    }

    // Add a function to parse timestamp to UTC milliseconds
    function parseTimestamp(timestamp) {
      if (!timestamp) return null;
    
      try {
        if (typeof timestamp === 'string' && timestamp.includes('-')) {
          // Convert "2025-03-30 00:00:00" to UTC timestamp
          const utcDate = new Date(timestamp.replace(' ', 'T') + 'Z');
          return utcDate.getTime();
        }
        
        // For numeric timestamps
        return typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
      } catch (error) {
        console.error('Error parsing timestamp:', error);
        return null;
      }
    }

    // Update the createMatchElement function to create more compact tiles
    function createMatchElement(match, type) {
      const matchItem = document.createElement('div');
      matchItem.classList.add('match-item');
      matchItem.setAttribute('data-type', type);
      
      // Get tournament name and icon
      const tournamentName = match.match_event || match.tournament_name;
      const tournamentIcon = getTournamentIcon(tournamentName);
      
      // Set background color based on tournament
      matchItem.style.cssText = getTournamentShineEffect(tournamentName);
      
      // Create tournament section with icon 
      const tournament = document.createElement('div');
      tournament.classList.add('tournament');
      if (tournamentIcon) {
        const iconImg = document.createElement('img');
        iconImg.src = tournamentIcon;
        iconImg.alt = 'Tournament Icon';
        iconImg.classList.add('tournament-icon');
        iconImg.onerror = () => { iconImg.style.display = 'none'; };
        tournament.appendChild(iconImg);
      }
      tournament.appendChild(document.createTextNode(tournamentName));
      matchItem.appendChild(tournament);
      
      // Add live indicator for live matches
      if (type === 'live') {
        const liveIndicator = document.createElement('div');
        liveIndicator.className = 'live-indicator';
        const dot = document.createElement('span');
        dot.className = 'dot';
        liveIndicator.appendChild(dot);
        liveIndicator.appendChild(document.createTextNode('LIVE'));
        matchItem.appendChild(liveIndicator);
      }
      
      // Create teams section
      const teams = document.createElement('div');
      teams.classList.add('teams');
      
      // Team 1
      const team1 = document.createElement('div');
      team1.classList.add('team');
      const team1Logo = document.createElement('img');
      team1Logo.src = getTeamLogo(match.team1);
      team1Logo.alt = match.team1;
      team1Logo.classList.add('team-logo');
      team1Logo.onerror = () => { team1Logo.style.display = 'none'; };
      const team1Name = document.createElement('span');
      team1Name.classList.add('team-name');
      team1Name.textContent = match.team1;
      team1.appendChild(team1Logo);
      team1.appendChild(team1Name);
      
      // Score
      const score = document.createElement('span');
      score.classList.add('score');
      if (type === 'live') {
        const team1Total = (parseInt(match.team1_round_ct) || 0) + (parseInt(match.team1_round_t) || 0);
        const team2Total = (parseInt(match.team2_round_ct) || 0) + (parseInt(match.team2_round_t) || 0);
        const mapName = match.current_map || 'Unknown Map';
        const mapScore = match.score1 && match.score2 ? `${match.score1}-${match.score2}` : '';
        
        const mapNameSpan = document.createElement('span');
        mapNameSpan.classList.add('map-name');
        mapNameSpan.textContent = mapName;
        
        const mapScoreSpan = document.createElement('span');
        mapScoreSpan.classList.add('map-score');
        mapScoreSpan.textContent = `${team1Total}-${team2Total}`;
        
        score.appendChild(mapNameSpan);
        score.appendChild(mapScoreSpan);
        if (mapScore) {
          const seriesScore = document.createElement('span');
          seriesScore.classList.add('map-name');
          seriesScore.textContent = `${mapScore}`;
          score.appendChild(seriesScore);
        }
      } else if (type === 'results') {
        if (match.score1 && match.score2) {
          score.textContent = `${match.score1}-${match.score2}`;
        } else {
          score.textContent = 'vs';
        }
      } else {
        score.textContent = 'vs';
      }
      
      // Team 2
      const team2 = document.createElement('div');
      team2.classList.add('team');
      const team2Logo = document.createElement('img');
      team2Logo.src = getTeamLogo(match.team2);
      team2Logo.alt = match.team2;
      team2Logo.classList.add('team-logo');
      team2Logo.onerror = () => { team2Logo.style.display = 'none'; };
      const team2Name = document.createElement('span');
      team2Name.classList.add('team-name');
      team2Name.textContent = match.team2;
      team2.appendChild(team2Logo);
      team2.appendChild(team2Name);
      
      teams.appendChild(team1);
      teams.appendChild(score);
      teams.appendChild(team2);
      
      matchItem.appendChild(teams);
      
      // Create time element with improved formatting - replace this section
      const timeContainer = document.createElement('div');
      timeContainer.classList.add('match-time-container');
      
      const time = document.createElement('span'); // Changed from p to span for better inline display
      time.classList.add('match-time');
      
      if (type === 'upcoming') {
        time.classList.add('upcoming-time');
        
        // Ensure proper timestamp parsing
        const timestamp = parseTimestamp(match.unix_timestamp);
        const matchTimeIST = formatDateTime(timestamp);
        
        // Add clock icon for better visual indication
        const clockIcon = document.createElement('i');
        clockIcon.className = 'fas fa-clock';
        time.appendChild(clockIcon);
        
        time.appendChild(document.createTextNode(' ' + matchTimeIST));
        timeContainer.appendChild(time);
        
        // Add time until match inline with the time
        if (match.time_until_match) {
          const timeUntil = document.createElement('span');
          timeUntil.classList.add('time-until-match');
          timeUntil.textContent = `${match.time_until_match}`;
          timeContainer.appendChild(timeUntil);
        }
      } else if (type === 'results') {
        time.textContent = match.time_completed || match.match_time || '';
        timeContainer.appendChild(time);
      } else {
        time.textContent = match.match_time || '';
        timeContainer.appendChild(time);
      }
      
      matchItem.appendChild(timeContainer);
      
      // Add notification button for upcoming matches
      if (type === 'upcoming') {
        // Parse timestamp once
        const timestamp = parseTimestamp(match.unix_timestamp);
        
        // Generate match ID once
        const matchId = match.id || `${match.team1}-${match.team2}-${match.unix_timestamp}`;
        
        // Store all match data in one place
        const matchData = {
          id: matchId,
          team1: match.team1,
          team2: match.team2,
          tournament: match.tournament_name || match.match_event || '',
          timestamp // Store parsed timestamp
        };
    
        const notifyButton = document.createElement('button');
        notifyButton.className = 'notify-button';
        
        // Store the match data directly in the button
        notifyButton.matchData = matchData;
        
        notifyButton.innerHTML = '<i class="far fa-bell"></i>';
        notifyButton.title = 'Get notified 5 minutes before match';
        
        notificationButtons.set(matchId, notifyButton);
        
        notifyButton.addEventListener('click', async (e) => {
          e.stopPropagation();
          const button = e.currentTarget;
          const { id, team1, team2, tournament, timestamp } = button.matchData;
          const isActive = button.classList.contains('active');
          
          if (isActive) {
            button.innerHTML = '<i class="far fa-bell"></i>';
            button.classList.remove('active');
            button.title = 'Get notified 5 minutes before match';
            
            chrome.runtime.sendMessage({
              action: 'cancelNotification',
              matchId: id
            });
            
            try {
              await deleteNotificationFromApi(id);
              console.log('Notification canceled in API:', id);
            } catch (error) {
              console.error('Failed to cancel notification in API:', error);
              button.innerHTML = '<i class="fas fa-bell"></i>';
              button.classList.add('active');
              button.title = 'Cancel notification';
            }
          } else {
            button.innerHTML = '<i class="fas fa-bell"></i>';
            button.classList.add('active');
            button.title = 'Cancel notification';
            
            if (isNaN(timestamp) || timestamp <= 0) {
              console.error(`Invalid match time: ${timestamp}`);
              alert('Could not schedule notification - invalid match time');
              return;
            }
            
            console.log(`Scheduling notification for match ${team1} vs ${team2}`);
            console.log(`Match time (GMT): ${new Date(timestamp).toISOString()}`);
            
            chrome.runtime.sendMessage({
              action: 'scheduleNotification',
              matchId: id,
              matchTime: timestamp,
              team1,
              team2,
              tournament
            }, async (response) => {
              if (response?.success) {
                try {
                  const notifiedMatches = await fetchNotificationsFromApi();
                  const readableTime = formatDateTime(timestamp, { includeDate: true });
                  
                  notifiedMatches[id] = {
                    time: timestamp.toString(),
                    team1,
                    team2,
                    tournament,
                    alarmTime: (timestamp - (5 * 60 * 1000)).toString(),
                    readableTime,
                    originalTimestamp: match.unix_timestamp
                  };
                  
                  await saveNotificationsToApi(notifiedMatches);
                  console.log('Notification scheduled in API:', id);
                } catch (error) {
                  console.error('Failed to schedule notification in API:', error);
                  button.innerHTML = '<i class="far fa-bell"></i>';
                  button.classList.remove('active');
                  button.title = 'Get notified 5 minutes before match';
                }
              } else {
                console.error('Failed to schedule notification in background script:', response);
                button.innerHTML = '<i class="far fa-bell"></i>';
                button.classList.remove('active');
                button.title = 'Get notified 5 minutes before match';
              }
            });
          }
        });
        
        const matchActions = document.createElement('div');
        matchActions.className = 'match-actions';
        matchActions.appendChild(notifyButton);
        matchItem.appendChild(matchActions);
      }
      
      matchItem.addEventListener('click', () => {
        let vlrUrl = '';
        if (type === 'results') {
          vlrUrl = `https://www.vlr.gg${match.match_page}`;
        } else {
          vlrUrl = match.match_page;
        }
        window.open(vlrUrl, '_blank');
      });
      
      return matchItem;
    }

    // Add this map to store references to notification buttons
    let notificationButtons = new Map();

    // Modify the displayUpcomingMatches function
    function displayUpcomingMatches(segments) {
      notificationButtons.clear(); // Clear the previous references
      
      matchListDiv.innerHTML = '';
      matchListDiv.classList.remove('results');
      if (segments?.length > 0) {
        segments.forEach(match => {
          matchListDiv.appendChild(createMatchElement(match, 'upcoming'));
        });
        
        // Now update notification states all at once after DOM is built
        updateNotificationUI();
      } else {
        matchListDiv.innerHTML = '<p class="no-matches">No upcoming matches found.</p>';
      }
    }

    // Add a function to update notification UI
    async function updateNotificationUI() {
      try {
        if (!userId) {
          userId = await getUserId();
        }
        
        console.log('Updating notification UI for user:', userId);
        
        // Fetch latest notification states from API
        const notifiedMatches = await fetchNotificationsFromApi();
        console.log('Current notifications from API:', notifiedMatches);
        
        // Update UI for each match
        for (const [matchId, button] of notificationButtons.entries()) {
          if (notifiedMatches[matchId]) {
            console.log('Setting active state for match:', matchId);
            button.innerHTML = '<i class="fas fa-bell"></i>';
            button.classList.add('active');
            button.title = 'Cancel notification';
          } else {
            button.innerHTML = '<i class="far fa-bell"></i>';
            button.classList.remove('active');
            button.title = 'Get notified 5 minutes before match';
          }
        }
      } catch (error) {
        console.error('Error updating notification UI:', error);
      }
    }

    function displayLiveMatches(segments) {
      matchListDiv.innerHTML = '';
      matchListDiv.classList.remove('results');
      if (segments?.length > 0) {
        segments.forEach(match => {
          matchListDiv.appendChild(createMatchElement(match, 'live'));
        });
      } else {
        matchListDiv.innerHTML = '<p class="no-matches">No live matches currently.</p>';
      }
    }
  
    function displayResults(segments) {
      matchListDiv.innerHTML = '';
      if (segments?.length > 0) {
        segments.forEach(match => {
          matchListDiv.appendChild(createMatchElement(match, 'results'));
        });
      } else {
        matchListDiv.innerHTML = '<p class="no-matches">No results found.</p>';
      }
    }
  
    upcomingButton.addEventListener('click', () => {
      liveButton.classList.remove('active');
      resultsButton.classList.remove('active');
      upcomingButton.classList.add('active');
      fetchMatchesViaProxy('upcoming');
    });
    liveButton.addEventListener('click', () => {
      upcomingButton.classList.remove('active');
      resultsButton.classList.remove('active');
      liveButton.classList.add('active');
      fetchMatchesViaProxy('live');
    });
    resultsButton.addEventListener('click', () => {
      upcomingButton.classList.remove('active');
      liveButton.classList.remove('active');
      resultsButton.classList.add('active');
      fetchMatchesViaProxy('results');
    });

    function createTestMatch() {
      // Create a match 6 minutes from now
      const now = new Date();
      const testTime = new Date(now.getTime() + (6 * 60 * 1000));
      
      // Format like regular matches: "YYYY-MM-DD HH:mm:ss"
      const formattedDate = testTime.toISOString()
        .replace('T', ' ')      // Replace T with space
        .slice(0, 19);         // Remove milliseconds and timezone
      
      const testMatch = {
        team1: "Test Team 1",
        team2: "Test Team 2",
        tournament_name: "Test Tournament",
        unix_timestamp: formattedDate,  // Use formatted date string
        match_page: "https://www.vlr.gg",
        id: `test-match-${Date.now()}`
      };
      
      console.log('Creating test match with formatted timestamp:', formattedDate);
      return testMatch;
    }

    // Update parseTimestamp to handle ISO strings better
    function parseTimestamp(timestamp) {
      if (!timestamp) return null;
    
      try {
        if (typeof timestamp === 'string') {
          if (timestamp.includes('T')) {
            // Handle ISO format
            return new Date(timestamp).getTime();
          } else if (timestamp.includes('-')) {
            // Handle "YYYY-MM-DD HH:mm:ss" format
            const [datePart, timePart] = timestamp.split(' ');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes, seconds] = timePart ? timePart.split(':').map(Number) : [0, 0, 0];
            
            const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
            return date.getTime();
          }
          // Handle numeric string
          return parseInt(timestamp);
        }
        // Handle numeric timestamp
        return timestamp;
      } catch (error) {
        console.error('Error parsing timestamp:', error, 'for input:', timestamp);
        return null;
      }
    }

    function addTestMatch() {
      const testMatch = createTestMatch();
      console.log('Created test match:', testMatch);
      
      const matchElement = createMatchElement(testMatch, 'upcoming');
      matchListDiv.insertBefore(matchElement, matchListDiv.firstChild);
      
      // Update notification buttons map
      updateNotificationUI();
    }
    
    // Add this near the end of DOMContentLoaded
    if (process.env.NODE_ENV === 'development') {
      // Add test button to header
      const testButton = document.createElement('button');
      testButton.textContent = 'Add Test Match';
      testButton.style.backgroundColor = '#ff4655';
      testButton.style.color = 'white';
      testButton.onclick = addTestMatch;
      document.querySelector('.header-right').appendChild(testButton);
    }

    // Improved loading state function
    function showLoadingState() {
      matchListDiv.innerHTML = '<div class="loading">Fetching latest matches...</div>';
    }

    function createFilterItem(tournamentName, isCategory = false, tournamentData = null) {
        const filter = document.createElement('div');
        filter.classList.add('dropdown-item');
        if (isCategory) filter.classList.add('category-item');
        
        const content = document.createElement('div');
        content.classList.add('dropdown-item-content');
    
        // Add tournament icon
        const icon = getTournamentIcon(tournamentName);
        if (icon) {
            const iconImg = document.createElement('img');
            iconImg.src = icon;
            iconImg.alt = tournamentName;
            iconImg.classList.add('tournament-icon');
            iconImg.onerror = () => {
                iconImg.style.display = 'none';
            };
            content.appendChild(iconImg);
        }
    
        const textSpan = document.createElement('span');
        textSpan.textContent = tournamentName;
        content.appendChild(textSpan);
        
        const checkIcon = document.createElement('i');
        checkIcon.className = 'fas fa-check';
        
        filter.appendChild(content);
        filter.appendChild(checkIcon);
        
        return filter;
    }
});
