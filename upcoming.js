// ...existing code...

function addNotificationIcons(matches) {
    matches.forEach(match => {
        const notificationIcon = document.createElement('button');
        notificationIcon.textContent = '🔔';
        notificationIcon.title = 'Notify me 5 mins before';
        notificationIcon.addEventListener('click', () => scheduleNotification(match));
        match.element.appendChild(notificationIcon);
    });
}

function scheduleNotification(match) {
    const matchTime = new Date(match.startTime).getTime();
    const notificationTime = matchTime - 5 * 60 * 1000; // 5 minutes before match start

    if (notificationTime > Date.now()) {
        chrome.alarms.create(match.id, { when: notificationTime });
        chrome.storage.local.set({ [match.id]: match });
        alert('Notification scheduled!');
    } else {
        alert('Match is starting soon or already started!');
    }
}

// Call this function after rendering matches
addNotificationIcons(upcomingMatches);
