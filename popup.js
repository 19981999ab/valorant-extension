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
  
    function displayUpcomingMatches(segments) {
      matchListDiv.innerHTML = '';
      if (segments?.length > 0) {
        segments.forEach(match => {
          const matchItem = document.createElement('div');
          matchItem.classList.add('match-item', 'upcoming-item');
          
          // Teams and Score
          const teamsContainer = document.createElement('div');
          teamsContainer.classList.add('teams');
          
          // Team 1 with logo
          const team1Container = document.createElement('div');
          team1Container.classList.add('team');
          
          if (match.team1_logo) {
            const team1Logo = document.createElement('img');
            team1Logo.src = match.team1_logo;
            team1Logo.alt = match.team1;
            team1Logo.classList.add('team-logo');
            team1Logo.onerror = () => { team1Logo.style.display = 'none'; };
            team1Container.appendChild(team1Logo);
          }
          
          const team1Name = document.createElement('span');
          team1Name.textContent = match.team1;
          team1Name.classList.add('team-name');
          team1Container.appendChild(team1Name);
          
          teamsContainer.appendChild(team1Container);
          
          const vs = document.createElement('span');
          vs.textContent = ' vs ';
          vs.classList.add('vs-text');
          teamsContainer.appendChild(vs);
          
          // Team 2 with logo
          const team2Container = document.createElement('div');
          team2Container.classList.add('team');
          
          if (match.team2_logo) {
            const team2Logo = document.createElement('img');
            team2Logo.src = match.team2_logo;
            team2Logo.alt = match.team2;
            team2Logo.classList.add('team-logo');
            team2Logo.onerror = () => { team2Logo.style.display = 'none'; };
            team2Container.appendChild(team2Logo);
          }
          
          const team2Name = document.createElement('span');
          team2Name.textContent = match.team2;
          team2Name.classList.add('team-name');
          team2Container.appendChild(team2Name);
          
          teamsContainer.appendChild(team2Container);
          
          matchItem.appendChild(teamsContainer);
          
          // Tournament Info
          const tournament = document.createElement('p');
          tournament.classList.add('tournament');
          tournament.textContent = match.match_event || 'N/A';
          matchItem.appendChild(tournament);
          
          if (match.match_series) {
            const series = document.createElement('p');
            series.classList.add('series');
            series.textContent = match.match_series;
            matchItem.appendChild(series);
          }
          
          const timeUntil = document.createElement('p');
          timeUntil.classList.add('match-time');
          timeUntil.textContent = `Starts in: ${match.time_until_match || 'N/A'}`;
          matchItem.appendChild(timeUntil);
          
          // Link
          const link = document.createElement('a');
          link.href = match.match_page;
          link.textContent = 'View on vlr.gg';
          link.target = '_blank';
          matchItem.appendChild(link);
          
          matchListDiv.appendChild(matchItem);
        });
      } else {
        matchListDiv.innerHTML = '<p class="no-matches">No upcoming matches found.</p>';
      }
    }
  
    function displayLiveMatches(segments) {
      matchListDiv.innerHTML = '';
      if (segments?.length > 0) {
        segments.forEach(match => {
          const matchItem = document.createElement('div');
          matchItem.classList.add('match-item', 'live-item');
          
          // Teams and Score
          const teamsContainer = document.createElement('div');
          teamsContainer.classList.add('teams');
          
          // Team 1 with logo
          const team1Container = document.createElement('div');
          team1Container.classList.add('team');
          
          if (match.team1_logo) {
            const team1Logo = document.createElement('img');
            team1Logo.src = match.team1_logo;
            team1Logo.alt = match.team1;
            team1Logo.classList.add('team-logo');
            team1Logo.onerror = () => { team1Logo.style.display = 'none'; };
            team1Container.appendChild(team1Logo);
          }
          
          const team1Name = document.createElement('span');
          team1Name.textContent = match.team1;
          team1Name.classList.add('team-name');
          team1Container.appendChild(team1Name);
          
          teamsContainer.appendChild(team1Container);
          
          // Score
          const score = document.createElement('div');
          score.classList.add('score');
          score.textContent = `${match.score1} - ${match.score2}`;
          teamsContainer.appendChild(score);
          
          // Team 2 with logo
          const team2Container = document.createElement('div');
          team2Container.classList.add('team');
          
          if (match.team2_logo) {
            const team2Logo = document.createElement('img');
            team2Logo.src = match.team2_logo;
            team2Logo.alt = match.team2;
            team2Logo.classList.add('team-logo');
            team2Logo.onerror = () => { team2Logo.style.display = 'none'; };
            team2Container.appendChild(team2Logo);
          }
          
          const team2Name = document.createElement('span');
          team2Name.textContent = match.team2;
          team2Name.classList.add('team-name');
          team2Container.appendChild(team2Name);
          
          teamsContainer.appendChild(team2Container);
          
          matchItem.appendChild(teamsContainer);
          
          // Map Information
          if (match.current_map) {
            const mapInfo = document.createElement('div');
            mapInfo.classList.add('map-info');
            mapInfo.innerHTML = `
              <span class="map-name">${match.current_map}</span>
              ${match.map_number ? `<span class="map-number">Map ${match.map_number}</span>` : ''}
            `;
            matchItem.appendChild(mapInfo);
          }
          
          // Round Details
          const roundDetails = document.createElement('div');
          roundDetails.classList.add('round-details');
          
          // Calculate total scores
          const team1Total = (parseInt(match.team1_round_ct) || 0) + (parseInt(match.team1_round_t) || 0);
          const team2Total = (parseInt(match.team2_round_ct) || 0) + (parseInt(match.team2_round_t) || 0);
          
          const team1Rounds = document.createElement('div');
          team1Rounds.classList.add('team-rounds');
          team1Rounds.innerHTML = `
            <span class="team-name">${match.team1}</span>
            <div class="rounds">
              <span class="round">${team1Total}</span>
            </div>
          `;
          
          const team2Rounds = document.createElement('div');
          team2Rounds.classList.add('team-rounds');
          team2Rounds.innerHTML = `
            <span class="team-name">${match.team2}</span>
            <div class="rounds">
              <span class="round">${team2Total}</span>
            </div>
          `;
          
          roundDetails.appendChild(team1Rounds);
          roundDetails.appendChild(team2Rounds);
          matchItem.appendChild(roundDetails);
          
          // Tournament Info
          const tournament = document.createElement('p');
          tournament.classList.add('tournament');
          tournament.textContent = match.match_event || 'N/A';
          matchItem.appendChild(tournament);
          
          if (match.match_series) {
            const series = document.createElement('p');
            series.classList.add('series');
            series.textContent = match.match_series;
            
            matchItem.appendChild(series);
          }
          
          // Live Badge
          const liveBadge = document.createElement('span');
          liveBadge.textContent = 'LIVE';
          liveBadge.classList.add('live-badge');
          matchItem.appendChild(liveBadge);
          
          // Link
          const link = document.createElement('a');
          link.href = match.match_page;
          link.textContent = 'View on vlr.gg';
          link.target = '_blank';
          matchItem.appendChild(link);
          
          matchListDiv.appendChild(matchItem);
        });
      } else {
        matchListDiv.innerHTML = '<p class="no-matches">No live matches currently.</p>';
      }
    }
  
    function displayResults(segments) {
      matchListDiv.innerHTML = '';
      if (segments?.length > 0) {
        segments.forEach(match => {
          const matchItem = document.createElement('div');
          matchItem.classList.add('match-item', 'result-item');
          
          // Teams and Score
          const teamsContainer = document.createElement('div');
          teamsContainer.classList.add('teams');
          
          // Team 1 with logo
          const team1Container = document.createElement('div');
          team1Container.classList.add('team');
          
          if (match.team1_logo) {
            const team1Logo = document.createElement('img');
            team1Logo.src = match.team1_logo;
            team1Logo.alt = match.team1;
            team1Logo.classList.add('team-logo');
            team1Logo.onerror = () => { team1Logo.style.display = 'none'; };
            team1Container.appendChild(team1Logo);
          }
          
          const team1Name = document.createElement('span');
          team1Name.textContent = match.team1;
          team1Name.classList.add('team-name');
          team1Container.appendChild(team1Name);
          
          teamsContainer.appendChild(team1Container);
          
          // Score
          const score = document.createElement('div');
          score.classList.add('score');
          score.textContent = `${match.score1 || '0'} - ${match.score2 || '0'}`;
          teamsContainer.appendChild(score);
          
          // Team 2 with logo
          const team2Container = document.createElement('div');
          team2Container.classList.add('team');
          
          if (match.team2_logo) {
            const team2Logo = document.createElement('img');
            team2Logo.src = match.team2_logo;
            team2Logo.alt = match.team2;
            team2Logo.classList.add('team-logo');
            team2Logo.onerror = () => { team2Logo.style.display = 'none'; };
            team2Container.appendChild(team2Logo);
          }
          
          const team2Name = document.createElement('span');
          team2Name.textContent = match.team2;
          team2Name.classList.add('team-name');
          team2Container.appendChild(team2Name);
          
          teamsContainer.appendChild(team2Container);
          
          matchItem.appendChild(teamsContainer);
          
          // Tournament Info with Icon
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
          
          const tournament = document.createElement('p');
          tournament.classList.add('tournament');
          tournament.textContent = match.tournament_name || match.match_event || 'N/A';
          tournamentContainer.appendChild(tournament);
          
          matchItem.appendChild(tournamentContainer);
          
          // Round Info
          if (match.round_info) {
            const roundInfo = document.createElement('p');
            roundInfo.classList.add('round-info');
            roundInfo.textContent = match.round_info;
            matchItem.appendChild(roundInfo);
          }
          
          // Match Time
          const timeContainer = document.createElement('div');
          timeContainer.classList.add('time-container');
          
          const completed = document.createElement('p');
          completed.classList.add('match-time');
          completed.textContent = match.time_completed || 'N/A';
          timeContainer.appendChild(completed);
          
          // Map Information if available
          if (match.current_map) {
            const mapInfo = document.createElement('div');
            mapInfo.classList.add('map-info');
            mapInfo.innerHTML = `
              <span class="map-name">${match.current_map}</span>
              ${match.map_number ? `<span class="map-number">Map ${match.map_number}</span>` : ''}
            `;
            timeContainer.appendChild(mapInfo);
          }
          
          matchItem.appendChild(timeContainer);
          
          // Link
          const link = document.createElement('a');
          link.href = match.match_page;
          link.textContent = 'View on vlr.gg';
          link.target = '_blank';
          matchItem.appendChild(link);
          
          matchListDiv.appendChild(matchItem);
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