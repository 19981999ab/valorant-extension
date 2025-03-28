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
    let currentMatches = [];
    let selectedTournaments = new Set();
  
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
          const filter = document.createElement('div');
          filter.classList.add('dropdown-item', 'category-item');
          filter.setAttribute('data-value', category.name);
          filter.setAttribute('data-tournaments', Array.from(category.tournaments).join(','));
          
          const content = document.createElement('span');
          if (category.icon) {
            const icon = document.createElement('img');
            icon.src = category.icon;
            icon.alt = category.name;
            icon.classList.add('category-icon');
            icon.onerror = () => { icon.style.display = 'none'; };
            content.appendChild(icon);
          }
          content.innerHTML += `<i class="fas fa-folder"></i> ${category.name}`;
          
          const checkIcon = document.createElement('i');
          checkIcon.className = 'fas fa-check';
          
          filter.appendChild(content);
          filter.appendChild(checkIcon);
          
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
          const filter = document.createElement('div');
          filter.classList.add('dropdown-item', 'tournament-item');
          filter.setAttribute('data-value', tournamentName);
          
          const content = document.createElement('span');
          if (tournament.icon) {
            const icon = document.createElement('img');
            icon.src = tournament.icon;
            icon.alt = tournamentName;
            icon.onerror = () => { icon.style.display = 'none'; };
            content.appendChild(icon);
          }
          content.appendChild(document.createTextNode(tournamentName));
          
          const checkIcon = document.createElement('i');
          checkIcon.className = 'fas fa-check';
          
          filter.appendChild(content);
          filter.appendChild(checkIcon);
          
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
      matchListDiv.innerHTML = '<p class="loading">Loading matches...</p>';
      try {
        const apiQuery = query === 'live' ? 'live_score' : query;
        const response = await fetch(`${proxyUrl}?q=${apiQuery}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        currentMatches = data.data.segments;
        currentQuery = query;
        
        // Clear selections when switching tabs
        selectedTournaments.clear();
        selectedText.textContent = 'All Tournaments';
        
        updateTournamentFilters(currentMatches);
        filterMatches();
      } catch (error) {
        matchListDiv.innerHTML = `<p class="error">Failed to load matches: ${error.message}</p>`;
      }
    }
  
    // Add color generation function
    function generateColor() {
      // Generate a random HSL color with good saturation and lightness for readability
      const hue = Math.random() * 360;
      // Use a higher saturation and lower lightness for more visible colors
      // Randomize saturation between 80-95% and lightness between 80-90%
      const saturation = 80 + Math.random() * 15;
      const lightness = 80 + Math.random() * 10;
      // Randomize opacity between 0.2 and 0.3 for more variation
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

    function createMatchElement(match, type) {
      const matchItem = document.createElement('div');
      matchItem.classList.add('match-item');
      
      // Get tournament name and color
      const tournamentName = match.match_event || match.tournament_name;
      const tournamentColor = getTournamentColor(tournamentName);
      
      // Apply tournament-specific background color
      matchItem.style.backgroundColor = tournamentColor;
      
      // Add live badge for live matches
      if (type === 'live') {
        const liveBadge = document.createElement('div');
        liveBadge.classList.add('live-badge');
        matchItem.appendChild(liveBadge);
      }
      
      // Create teams section
      const teams = document.createElement('div');
      teams.classList.add('teams');
      
      // Team 1
      const team1 = document.createElement('div');
      team1.classList.add('team');
      const team1Logo = document.createElement('img');
      team1Logo.src = match.team1_logo || `https://www.vlr.gg/img/vlr/tmp/vlr_${match.flag1}.png`;
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
        score.innerHTML = `${mapName}: ${team1Total}-${team2Total}<br>${mapScore}`;
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
      team2Logo.src = match.team2_logo || `https://www.vlr.gg/img/vlr/tmp/vlr_${match.flag2}.png`;
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
      
      // Tournament name
      const tournament = document.createElement('p');
      tournament.classList.add('tournament');
      if (type === 'results' && match.tournament_icon) {
        const tournamentIcon = document.createElement('img');
        tournamentIcon.src = match.tournament_icon;
        tournamentIcon.alt = 'Tournament Icon';
        tournamentIcon.classList.add('tournament-icon');
        tournamentIcon.onerror = () => { tournamentIcon.style.display = 'none'; };
        tournament.appendChild(tournamentIcon);
      }
      tournament.appendChild(document.createTextNode(tournamentName));
      
      // Match time
      const time = document.createElement('p');
      time.classList.add('match-time');
      if (type === 'upcoming') {
        time.classList.add('upcoming');
        time.textContent = `Starts in: ${match.time_until_match || 'N/A'}`;
      } else if (type === 'results') {
        time.textContent = match.time_completed || match.match_time || '';
      } else {
        time.textContent = match.match_time || '';
      }
      
      matchItem.appendChild(teams);
      matchItem.appendChild(tournament);
      matchItem.appendChild(time);
      
      // Tournament Info
      const tournamentInfo = document.createElement('div');
      tournamentInfo.classList.add('tournament-info');
      
      // Map Information
      if (match.current_map) {
        const mapInfo = document.createElement('div');
        mapInfo.classList.add('map-info');
        mapInfo.innerHTML = `
          <span class="map-name">${match.current_map}</span>
          ${match.map_number ? `<span class="map-number">Map ${match.map_number}</span>` : ''}
        `;
        tournamentInfo.appendChild(mapInfo);
      }
      
      // Round Details for live matches
      if (type === 'live') {
        // Remove this section entirely
      }
      
      // Tournament Container with Icon
      const tournamentContainer = document.createElement('div');
      tournamentContainer.classList.add('tournament-container');
      
      if (match.tournament_icon) {
        const tournamentIcon = document.createElement('img');
        tournamentIcon.src = match.tournament_icon;
        tournamentIcon.alt = 'Tournament Icon';
        tournamentIcon.classList.add('tournament-icon');
        tournamentIcon.onerror = () => { tournamentIcon.style.display = 'none'; };
        tournamentContainer.appendChild(tournamentIcon);
      }
      
      const tournamentNameElement = document.createElement('p');
      tournamentNameElement.classList.add('tournament');
      tournamentNameElement.textContent = match.tournament_name || match.match_event || 'N/A';
      tournamentContainer.appendChild(tournamentNameElement);
      
      tournamentInfo.appendChild(tournamentContainer);
      
      // Round Info for results
      if (type === 'results' && match.round_info) {
        const roundInfo = document.createElement('p');
        roundInfo.classList.add('round-info');
        roundInfo.textContent = match.round_info;
        tournamentInfo.appendChild(roundInfo);
      }
      
      // Time Container
      const timeContainer = document.createElement('div');
      timeContainer.classList.add('time-container');
      
      const timeText = document.createElement('p');
      timeText.classList.add('match-time');
      if (type === 'upcoming') {
        timeText.classList.add('upcoming');
      }
      timeText.textContent = type === 'upcoming' 
        ? `Starts in: ${match.time_until_match || 'N/A'}`
        : type === 'live'
        ? 'LIVE'
        : match.time_completed || 'N/A';
      timeContainer.appendChild(timeText);
      
      tournamentInfo.appendChild(timeContainer);
      
      // Link
      const link = document.createElement('a');
      link.href = match.match_page;
      link.textContent = 'View on vlr.gg';
      link.target = '_blank';
      tournamentInfo.appendChild(link);
      
      matchItem.appendChild(tournamentInfo);
      
      // Add click handler
      matchItem.addEventListener('click', () => {
        if (match.match_page) {
          const fullUrl = type === 'results' 
            ? `https://www.vlr.gg${match.match_page}`
            : match.match_page;
          window.open(fullUrl, '_blank');
        }
      });
      
      return matchItem;
    }

    function displayUpcomingMatches(segments) {
      matchListDiv.innerHTML = '';
      matchListDiv.classList.remove('results');
      if (segments?.length > 0) {
        segments.forEach(match => {
          matchListDiv.appendChild(createMatchElement(match, 'upcoming'));
        });
      } else {
        matchListDiv.innerHTML = '<p class="no-matches">No upcoming matches found.</p>';
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
  
    upcomingButton.addEventListener('click', () => fetchMatchesViaProxy('upcoming'));
    liveButton.addEventListener('click', () => fetchMatchesViaProxy('live'));
    resultsButton.addEventListener('click', () => fetchMatchesViaProxy('results'));
  
    // Load live matches by default
    fetchMatchesViaProxy('live');
});