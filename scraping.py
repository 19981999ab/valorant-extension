import asyncio
import aiohttp
from bs4 import BeautifulSoup
import json
import os
import time
from tqdm import tqdm  # for progress bar

async def get_team_logo_url(session, url):
    """
    Scrapes a VLR.gg team page to get the team logo URL.

    Args:
        session: aiohttp ClientSession
        url (str): The URL of the VLR.gg team page.
    Returns:
        dict: Dictionary containing team name and logo URL
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }

        async with session.get(url, headers=headers, timeout=10) as response:
            # Skip if page not found (404) or other client/server errors
            if response.status != 200:
                return None
                
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')

            # Get team name
            team_name_element = soup.find('h1', class_='wf-title')
            if not team_name_element:  # Skip if no team name found (probably not a valid team page)
                return None
                
            team_name = team_name_element.text.strip()

            # Find the div with class wf-avatar team-header-logo
            logo_div = soup.find('div', class_=['wf-avatar', 'team-header-logo'])
            
            if logo_div:
                logo_element = logo_div.find('img')
                
                if logo_element and 'src' in logo_element.attrs:
                    logo_url = logo_element['src']
                    
                    # Handle relative URLs
                    if not logo_url.startswith('http'):
                        if logo_url.startswith('//'):
                            logo_url = 'https:' + logo_url
                        else:
                            base_url = 'https://www.vlr.gg'
                            logo_url = base_url + logo_url

                    return {
                        'team_id': url.split('/team/')[1].split('/')[0],
                        'team_name': team_name,
                        'logo_url': logo_url
                    }

            return None

    except Exception as e:
        return None

def load_existing_teams(output_file):
    """Load existing teams from JSON file if it exists"""
    if os.path.exists(output_file):
        with open(output_file, 'r', encoding='utf-8') as f:
            return {team['team_id']: team for team in json.load(f)}
    return {}

async def process_batch(session, team_ids, base_url, pbar, team_logos, existing_teams, output_file, save_interval, request_count):
    """Process a batch of team IDs in parallel"""
    tasks = []
    for team_id in team_ids:
        url = f"{base_url}{team_id}"
        tasks.append(get_team_logo_url(session, url))
    
    results = await asyncio.gather(*tasks)
    request_count[0] += len(tasks)  # Update request count
    
    for result in results:
        # Skip if no result or if team already exists or if it has the default VLR logo
        if (not result or 
            result['team_id'] in existing_teams or 
            result['logo_url'] == 'https://www.vlr.gg/img/vlr/tmp/vlr.png'):
            continue
        
        team_logos.append(result)
        existing_teams[result['team_id']] = result
        pbar.set_postfix({
            'Teams Found': len(team_logos),
            'Requests Made': request_count[0]
        })
        
        # Save progress periodically
        if len(team_logos) % save_interval == 0:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(list(existing_teams.values()), f, indent=2, ensure_ascii=False)
    
    # Update progress bar for this batch
    pbar.update(len(team_ids))

async def scrape_range(session, start_id, end_id, base_url, pbar, team_logos, existing_teams, output_file, save_interval, request_count, batch_size=3):
    """Scrape a specific range of team IDs"""
    for i in range(start_id, end_id + 1, batch_size):
        batch = range(i, min(i + batch_size, end_id + 1))
        await process_batch(session, batch, base_url, pbar, team_logos, existing_teams, output_file, save_interval, request_count)
        
        # Add a small delay between batches to be nice to the server
        if i + batch_size <= end_id:
            await asyncio.sleep(0.5)

async def save_team_logos_to_json(output_file='team_logos.json', save_interval=50, batch_size=5):
    """
    Saves team logos information to a JSON file for multiple ranges.
    """
    # Load existing teams
    existing_teams = load_existing_teams(output_file)
    team_logos = list(existing_teams.values())
    base_url = "https://www.vlr.gg/team/"
    
    # Define ranges to scrape
    ranges = [
        (17000, 18000)
    ]
    
    # Calculate total iterations for progress bar
    total_iterations = sum(end - start + 1 for start, end in ranges)
    
    # Create progress bar
    pbar = tqdm(total=total_iterations, desc="Scraping teams", unit="teams")
    
    # Initialize request counter
    request_count = [0]
    
    async with aiohttp.ClientSession() as session:
        for start_id, end_id in ranges:
            await scrape_range(session, start_id, end_id, base_url, pbar, team_logos, existing_teams, output_file, save_interval, request_count, batch_size)
    
    # Save final results
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(list(existing_teams.values()), f, indent=2, ensure_ascii=False)
    
    print(f"\nCompleted! Found {len(team_logos)} teams out of {request_count[0]} requests made to {output_file}")

if __name__ == "__main__":
    asyncio.run(save_team_logos_to_json())