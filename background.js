// Function to fetch and cache data
async function fetchAndCacheData(type) {
  try {
    console.log(`Fetching ${type} data from proxy...`);
    const response = await fetch(`https://valorant-proxy.vercel.app/api/proxy?q=${type}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Cache the data
    console.log(`Caching ${type} data...`);
    chrome.storage.local.set({ [type]: data }, () => {
      console.log(`${type} data cached successfully`);
    });
    
    return data;
  } catch (error) {
    console.error(`Error fetching ${type}:`, error);
    return null;
  }
}

// Function to update badge
function updateBadge(count) {
  chrome.action.setBadgeText({ text: count.toString() });
  chrome.action.setBadgeBackgroundColor({ color: '#FF4655' });
}

// Function to check for new matches
async function checkForNewMatches() {
  try {
    const liveData = await fetchAndCacheData('live');
    if (liveData && liveData.data && liveData.data.segments) {
      const liveMatches = liveData.data.segments;
      updateBadge(liveMatches.length);
    }
  } catch (error) {
    console.error('Error checking for new matches:', error);
  }
}

// Function to format date/time in IST
function formatTimeIST(timestamp) {
  if (!timestamp) return 'N/A';
  
  // Create date from timestamp
  const date = new Date(timestamp);
  
  // Format in IST (+5:30) using IANA timezone
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  }).format(date) + ' IST';
}

// Function to format full date and time in IST for logging
function formatDateTimeIST(timestamp) {
  if (!timestamp) return 'N/A';
  
  const date = new Date(parseInt(timestamp));
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  }).format(date) + ' IST';
}

// Initial data fetch and setup notification persistence
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated, fetching initial data...');
  fetchAndCacheData('upcoming');
  fetchAndCacheData('live');
  fetchAndCacheData('results');
  
  // Initialize notifiedMatches if it doesn't exist
  chrome.storage.local.get('notifiedMatches', (data) => {
    if (!data.notifiedMatches) {
      chrome.storage.local.set({ notifiedMatches: {} });
    }
  });
  
  // Sync notification states with API
  syncNotificationStates();
});

// Clean up expired notifications on startup
chrome.runtime.onStartup.addListener(() => {
  cleanupExpiredNotifications();
});

// Function to clean up expired notifications
function cleanupExpiredNotifications() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['notifiedMatches', 'userId'], async (data) => {
      const notifiedMatches = data.notifiedMatches || {};
      const userId = data.userId;
      const currentTime = Date.now();
      let hasChanges = false;
      
      // Check each notification and remove if the match time has passed
      for (const matchId of Object.keys(notifiedMatches)) {
        const matchData = notifiedMatches[matchId];
        if (matchData.alarmTime && matchData.alarmTime < currentTime) {
          delete notifiedMatches[matchId];
          hasChanges = true;
          console.log('Cleaned up expired notification for match:', matchId);
        }
      }
      
      // Save cleaned up notifiedMatches back to storage
      if (hasChanges) {
        await new Promise(resolveStorage => {
          chrome.storage.local.set({ notifiedMatches }, resolveStorage);
        });
        
        // Sync with API if we have a userId
        if (userId) {
          try {
            const response = await fetch('https://valorant-proxy.vercel.app/api/notification', {
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
              console.error('Failed to sync cleaned up notifications with API');
            } else {
              console.log('Cleaned up notifications synced with API');
            }
          } catch (error) {
            console.error('Error syncing cleaned up notifications:', error);
          }
        }
      }
      
      resolve();
    });
  });
}

// Set up periodic updates
chrome.alarms.create('updateData', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateData') {
    console.log('Periodic update triggered...');
    fetchAndCacheData('upcoming');
    fetchAndCacheData('live');
    fetchAndCacheData('results');
  } else if (alarm.name === 'syncNotifications') {
    console.log('Notification sync triggered...');
    syncNotificationStates();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('match_notification_')) {
    const matchId = alarm.name.replace('match_notification_', '');
    
    try {
      // Get user ID first
      const userData = await new Promise(resolve => {
        chrome.storage.local.get('userId', resolve);
      });
      
      if (!userData.userId) {
        console.error('No userId found, cannot show notification');
        return;
      }
      
      // Fetch notifications from API
      const response = await fetch(`https://valorant-proxy.vercel.app/api/notification?userId=${userData.userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const notifiedMatches = data.notifiedMatches || {};
      const matchData = notifiedMatches[matchId];
      
      if (matchData) {
        // Show notification with IST time
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Valorant Match Starting Soon',
          message: `${matchData.team1} vs ${matchData.team2} starts in 5 minutes!`,
          contextMessage: `${matchData.tournament || 'Valorant Match'} - ${formatTimeIST(parseInt(matchData.time))}`,
          priority: 2
        });
        
        // Remove from API
        try {
          const deleteResponse = await fetch('https://valorant-proxy.vercel.app/api/notification', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: userData.userId,
              matchId
            })
          });
          
          if (!deleteResponse.ok) {
            console.error('Failed to remove notification from API after it fired');
          } else {
            console.log('Removed fired notification from API');
          }
        } catch (error) {
          console.error('Error removing notification from API:', error);
        }
      }
    } catch (error) {
      console.error('Error handling notification alarm:', error);
    }
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getData') {
    console.log(`Content script requested ${request.dataType} data`);
    chrome.storage.local.get([request.dataType], (result) => {
      console.log(`Retrieved ${request.dataType} data from storage:`, result[request.dataType]);
      sendResponse(result[request.dataType]);
    });
    return true; // Will respond asynchronously
  }
});

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scheduleNotification') {
    // Parse and validate the match time
    const matchTimeRaw = request.matchTime;
    console.log(`Received match time: ${matchTimeRaw}, Type: ${typeof matchTimeRaw}`);
    
    let matchTimeInt;
    if (typeof matchTimeRaw === 'string') {
      matchTimeInt = parseInt(matchTimeRaw);
    } else if (typeof matchTimeRaw === 'number') {
      matchTimeInt = matchTimeRaw;
    } else {
      console.error('Invalid match time type:', typeof matchTimeRaw);
      sendResponse({ 
        success: false, 
        message: 'Invalid match time type',
        matchTime: matchTimeRaw
      });
      return true;
    }
    
    if (isNaN(matchTimeInt) || matchTimeInt <= 0) {
      console.error('Invalid match time provided:', matchTimeRaw);
      sendResponse({ 
        success: false, 
        message: 'Invalid match time provided',
        matchTime: matchTimeRaw
      });
      return true;
    }
    
    // Validate timestamp is reasonable (must be after 2023)
    const minValidTime = new Date('2023-01-01').getTime();
    
    // If timestamp is in seconds (from Unix epoch), convert to milliseconds
    if (matchTimeInt > 0 && matchTimeInt < minValidTime / 1000) {
      console.log('Timestamp appears to be in seconds, converting to milliseconds');
      matchTimeInt *= 1000;
    }
    
    // Final validation - must be after Jan 1, 2023
    if (matchTimeInt < minValidTime) {
      console.error('Timestamp seems invalid (too old):', matchTimeInt);
      sendResponse({ 
        success: false, 
        message: 'Invalid timestamp (too old or malformed)',
        matchTime: matchTimeRaw,
        parsedTime: matchTimeInt,
        formattedTime: new Date(matchTimeInt).toISOString()
      });
      return true;
    }
    
    // Create an alarm 5 minutes before the match
    const alarmTime = matchTimeInt - (5 * 60 * 1000);
    const currentTime = Date.now();
    
    console.log('Scheduling notification for match:', request.matchId);
    console.log('Match time (GMT):', new Date(matchTimeInt).toISOString());
    console.log('Match time (IST):', formatDateTimeIST(matchTimeInt + (5.5 * 60 * 60 * 1000)));
    console.log('Current time (GMT):', new Date(currentTime).toISOString());
    console.log('Current time (IST):', formatDateTimeIST(currentTime + (5.5 * 60 * 60 * 1000)));
    console.log('Notification time (GMT):', new Date(alarmTime).toISOString());
    console.log('Notification time (IST):', formatDateTimeIST(alarmTime + (5.5 * 60 * 60 * 1000)));
    
    // Only schedule if the alarm time is in the future
    if (alarmTime > currentTime) {
      // Create a match-specific alarm name for better tracking
      const alarmName = `match_notification_${request.matchId}`;
      
      chrome.alarms.create(alarmName, {
        when: alarmTime
      });
      
      sendResponse({ 
        success: true, 
        message: `Notification scheduled for ${formatTimeIST(alarmTime)}`,
        matchTime: matchTimeInt,
        formattedMatchTime: formatDateTimeIST(matchTimeInt),
        alarmTime: alarmTime,
        formattedAlarmTime: formatDateTimeIST(alarmTime)
      });
    } else {
      console.log('Match is too soon to schedule notification');
      console.log(`Alarm time (GMT): ${new Date(alarmTime).toISOString()}`);
      console.log(`Current time (GMT): ${new Date(currentTime).toISOString()}`);
      console.log(`Time difference: ${alarmTime - currentTime}ms`);
      
      sendResponse({ 
        success: false, 
        message: 'Match is too soon to schedule notification',
        matchTime: matchTimeInt,
        formattedMatchTime: formatDateTimeIST(matchTimeInt),
        currentTime: currentTime,
        formattedCurrentTime: formatDateTimeIST(currentTime),
        alarmTime: alarmTime,
        formattedAlarmTime: formatDateTimeIST(alarmTime),
        timeDifference: alarmTime - currentTime
      });
    }
    return true; // Keeps the message channel open for async response
  }
  
  if (request.action === 'cancelNotification') {
    console.log('Canceling notification for match:', request.matchId);
    
    // Use match-specific alarm name
    const alarmName = `match_notification_${request.matchId}`;
    
    chrome.alarms.clear(alarmName, (wasCleared) => {
      console.log('Alarm cleared:', wasCleared);
    });
    
    // No longer removing from local storage - notifications are stored in API
    
    sendResponse({ success: true, message: 'Notification canceled' });
    return true; // Keeps the message channel open for async response
  }
  
  // ...existing code...
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scheduleNotification') {
    // Parse and validate the IST match time
    const matchTimeIST = parseInt(request.matchTime);
    console.log(`Received IST match time: ${matchTimeIST}`);
    console.log(`IST time formatted: ${formatDateTimeIST(matchTimeIST)}`);
    
    if (isNaN(matchTimeIST) || matchTimeIST <= 0) {
      console.error('Invalid match time provided:', matchTimeIST);
      sendResponse({ 
        success: false, 
        message: 'Invalid match time provided'
      });
      return true;
    }
    
    // Create notification 5 minutes before match time
    const notificationTime = matchTimeIST - (5 * 60 * 1000);
    const currentTime = Date.now() + (5.5 * 60 * 60 * 1000); // Current time in IST
    
    console.log('Scheduling notification for match:', request.matchId);
    console.log('Match time (IST):', formatDateTimeIST(matchTimeIST));
    console.log('Current time (IST):', formatDateTimeIST(currentTime));
    console.log('Notification time (IST):', formatDateTimeIST(notificationTime));
    
    if (notificationTime > currentTime) {
      const alarmName = `match_notification_${request.matchId}`;
      
      // Convert notification time back to GMT for chrome.alarms
      const notificationTimeGMT = notificationTime - (5.5 * 60 * 60 * 1000);
      chrome.alarms.create(alarmName, {
        when: notificationTimeGMT
      });
      
      sendResponse({ 
        success: true, 
        message: `Notification scheduled for ${formatTimeIST(notificationTime)}`,
        matchTimeIST: matchTimeIST,
        formattedTime: formatDateTimeIST(matchTimeIST)
      });
    } else {
      console.log('Match is too soon to schedule notification');
      sendResponse({ 
        success: false, 
        message: 'Match is too soon to schedule notification',
        matchTimeIST: matchTimeIST,
        currentTimeIST: currentTime,
        formattedMatchTime: formatDateTimeIST(matchTimeIST)
      });
    }
    return true;
  }
  
  // ...existing code...
});

// Add a function to sync notification states with the API
async function syncNotificationStates(force = false) {
  // This function is no longer needed as we're always accessing the API directly
  // But we'll keep it for backward compatibility - it just won't do anything
  console.log('Notification sync no longer needed - using API directly');
}

// Add periodic sync for notification states
chrome.alarms.create('syncNotifications', { periodInMinutes: 15 });