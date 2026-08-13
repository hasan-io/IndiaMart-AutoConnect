// Firebase API Key for authentication
const FIREBASE_API_KEY = "AIzaSyATjm5ngvh5qmBlBnS_hLh6mjhn_uMeCHs";

// Create an alarm to check authentication every 1 minute
chrome.alarms.create('authCheck', {
  periodInMinutes: 1
});

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  // Check if the alarm is the authCheck alarm
  if (alarm.name === 'authCheck') {
    // Get refreshToken from storage
    chrome.storage.local.get(['refreshToken'], async (result) => {
      // If no refreshToken exists, return
      if (!result.refreshToken) return;

      try {
        // Send refresh token to Firebase to get new ID token
        const response = await fetch(
          'https://securetoken.googleapis.com/v1/token?key=' + FIREBASE_API_KEY,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=refresh_token&refresh_token=' + result.refreshToken
          }
        );

        const data = await response.json();

        // Check if there's an error (account disabled/revoked)
        if (data.error) {
          console.log('SECURITY ALERT: Account disabled. Wiping local memory...');

          // Remove sensitive data
          chrome.storage.local.remove(['secretTargetKey', 'refreshToken']);

          // Disable the bot
          chrome.storage.local.set({
            botEnabled: false
          });
        }
      } catch (error) {
        // If fetch fails, do nothing (network error, etc.)
      }
    });
  }
});