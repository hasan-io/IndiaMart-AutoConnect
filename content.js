const FIREBASE_API_KEY = "AIzaSyATjm5ngvh5qmBlBnS_hLh6mjhn_uMeCHs";
const FIREBASE_PROJECT_ID = "lead-connect-df1c8";

let autoRefreshTimer = null;

// Initialize on page load
console.log('IndiaMart Lead Sniper: Initialized (Vault Secured Mode).');

// Listen for storage changes from popup
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    console.log('⚡ Configuration changed! Re-checking leads immediately...');
    checkTopLead();
    setupAutoRefresh();
  }
});

// Initial lead check on page load
setTimeout(checkTopLead, 500);
setTimeout(setupAutoRefresh, 500);

// Check for new leads added to the page dynamically
const observer = new MutationObserver(() => {
  checkTopLead();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false
});

// Main function to check and click leads
function checkTopLead() {
  chrome.storage.local.get(
    ['botEnabled', 'mobileOnly', 'secretTargetKey', 'selectedCountries', 'selectedMedicines', 'selectedRules'],
    (result) => {
      console.log('📋 Storage Retrieved:', result);
      console.log('🔍 botEnabled:', result.botEnabled);
      console.log('🔑 secretTargetKey:', result.secretTargetKey);
      console.log('💊 selectedMedicines:', result.selectedMedicines);
      console.log('🌍 selectedCountries:', result.selectedCountries);
      console.log('📏 selectedRules:', result.selectedRules);

      if (!result.botEnabled || !result.secretTargetKey) {
        console.log('❌ Bot disabled or no secretTargetKey');
        return;
      }

      console.log('✅ Bot enabled, proceeding...');

      // Find all lead cards on the portal
      const leadCards = document.querySelectorAll('[id^="BLCard"]');
      console.log('🔍 Found ' + leadCards.length + ' lead card(s)');

      leadCards.forEach((card) => {
        const cardId = card.getAttribute('id');
        console.log('\n📍 Checking lead card: ' + cardId);

        // Get the target button - try multiple selectors
        let targetButton = card.querySelector(result.secretTargetKey);
        if (!targetButton) {
          // Fallback selectors if secretTargetKey doesn't work
          targetButton = card.querySelector('.SLC_FillCTA');
        }
        if (!targetButton) {
          targetButton = card.querySelector('button.SLC_FillCTA');
        }
        if (!targetButton) {
          console.log('  ❌ Target button not found - tried:', result.secretTargetKey, '.SLC_FillCTA', 'button.SLC_FillCTA');
          return;
        }
        console.log('  ✅ Target button found');

        // Extract medicine name
        const medicineElement = card.querySelector('.SLC_f18');
        const medicineName = medicineElement ? medicineElement.innerText.trim() : 'Unknown';
        console.log('  💊 Extracted medicineName: ' + medicineName);

        // Extract country name
        const countryElement = card.querySelector('strong.BuyLC_tltpw');
        const countryName = countryElement ? countryElement.innerText.trim() : 'Unknown';
        console.log('  🌍 Extracted countryName: ' + countryName);

        // Check mobile availability
        const mobileElement = card.querySelector('.tooltip_vfr');
        const mobileAvailable = mobileElement && mobileElement.innerText.includes('Available');
        console.log('  📱 Mobile available: ' + mobileAvailable);

        // Check if mobileOnly is enabled
        if (result.mobileOnly && !mobileAvailable) {
          console.log('  ⚠️  Mobile not available (mobileOnly is ON)');
          return;
        }

        // Check rules
        console.log('  📏 Checking rules...');
        let ruleMatched = false;

        if (result.selectedRules && result.selectedRules.length > 0) {
          for (const rule of result.selectedRules) {
            const [ruleMedicine, ruleCountry] = rule.split(' ➔ ');
            const medMatch = medicineName.toLowerCase().includes(ruleMedicine.toLowerCase());
            const countryMatch = countryName.toLowerCase().includes(ruleCountry.toLowerCase());

            console.log('    Rule: ' + rule + ' | Medicine match: ' + medMatch + ' | Country match: ' + countryMatch);

            if (medMatch && countryMatch) {
              console.log('    ✅ Rule matched!');
              ruleMatched = true;
              break;
            }
          }
        }

        // Check individual selections
        console.log('  📋 Checking individual selections...');
        let selectedMatch = false;

        // Check if medicine is selected
        if (result.selectedMedicines && result.selectedMedicines.length > 0) {
          const medSelected = result.selectedMedicines.some(med =>
            medicineName.toLowerCase().includes(med.toLowerCase())
          );
          console.log('    Medicine selected: ' + medSelected);
          if (medSelected) selectedMatch = true;
        }

        // Check if country is selected
        if (result.selectedCountries && result.selectedCountries.length > 0) {
          const countrySelected = result.selectedCountries.some(country =>
            countryName.toLowerCase().includes(country.toLowerCase())
          );
          console.log('    Country selected: ' + countrySelected);
          if (countrySelected) selectedMatch = true;
        }

        // Decide if lead matches
        let shouldClick = false;

        if (result.selectedRules && result.selectedRules.length > 0) {
          // If rules exist, prioritize rules
          shouldClick = ruleMatched;
        } else if (result.selectedMedicines && result.selectedMedicines.length > 0 && 
                   result.selectedCountries && result.selectedCountries.length > 0) {
          // If both medicine and country selections exist, require both
          const medSelected = result.selectedMedicines.some(med =>
            medicineName.toLowerCase().includes(med.toLowerCase())
          );
          const countrySelected = result.selectedCountries.some(country =>
            countryName.toLowerCase().includes(country.toLowerCase())
          );
          shouldClick = medSelected && countrySelected;
        } else if (result.selectedMedicines && result.selectedMedicines.length > 0) {
          // If only medicine selected, check medicine
          shouldClick = result.selectedMedicines.some(med =>
            medicineName.toLowerCase().includes(med.toLowerCase())
          );
        } else if (result.selectedCountries && result.selectedCountries.length > 0) {
          // If only country selected, check country
          shouldClick = result.selectedCountries.some(country =>
            countryName.toLowerCase().includes(country.toLowerCase())
          );
        }

        if (!shouldClick) {
          console.log('  ❌ No match found for this lead');
          return;
        }

        // Click the button
        console.log('🎯 SNIPER: MATCH FOUND! Clicking -> [ ' + medicineName + ' | ' + countryName + ' | ' + medicineName + ' ]');
        targetButton.click();
      });
    }
  );
}

// ✅ FIXED: Auto-refresh with debug logs
function setupAutoRefresh() {
  console.log('⏱️ setupAutoRefresh() called');

  if (autoRefreshTimer) {
    console.log('🔄 Clearing old timer:', autoRefreshTimer);
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  chrome.storage.local.get(
    ['botEnabled', 'autoRefresh', 'refreshInterval'],
    (result) => {
      console.log('📋 Auto-refresh config:', result);

      if (result.botEnabled && result.autoRefresh && result.refreshInterval >= 1) {
        const refreshMs = result.refreshInterval * 1000;
        console.log('✅ AUTO-REFRESH ENABLED: Reloading every ' + refreshMs + 'ms');

        autoRefreshTimer = setInterval(() => {
          console.log('🔄 Portal refreshing now...');
          window.location.reload();
        }, refreshMs);

        console.log('🔄 Timer ID:', autoRefreshTimer);
      } else {
        console.log('❌ Auto-refresh disabled or invalid config');
      }
    }
  );
}