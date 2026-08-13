const FIREBASE_API_KEY = "AIzaSyATjm5ngvh5qmBlBnS_hLh6mjhn_uMeCHs";
const FIREBASE_PROJECT_ID = "lead-connect-df1c8";

let availableMedicines = ['Anavar', 'Oxandrolone'];
let availableCountries = ['Spain', 'United Kingdom'];
let availableRules = ['Ivermectin ➔ USA'];

// Load saved data on page load
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(
    [
      'secretTargetKey',
      'botEnabled',
      'mobileOnly',
      'autoRefresh',
      'refreshInterval',
      'savedMedicines',
      'savedCountries',
      'selectedMedicines',
      'selectedCountries',
      'selectedRules',
      'medSort',
      'countrySort',
      'ruleSort'
    ],
    (result) => {
      if (result.secretTargetKey) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appScreen').style.display = 'block';
        loadAppUI(result);
      } else {
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('appScreen').style.display = 'none';
      }
    }
  );

  // ✅ FIX: Handle form submission instead of button click
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // ✅ CRITICAL: Prevent form submission
      
      const email = document.getElementById('emailInput').value.trim();
      const password = document.getElementById('passInput').value;
      const errorDiv = document.getElementById('loginError');
      const loginBtn = document.getElementById('loginBtn');

      if (!email || !password) return;

      loginBtn.innerText = 'Authenticating...';
      errorDiv.style.display = 'none';

      try {
        // Firebase authentication
        const authUrl =
          'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' +
          FIREBASE_API_KEY;

        const authResponse = await fetch(authUrl, {
          method: 'POST',
          body: JSON.stringify({
            email: email,
            password: password,
            returnSecureToken: true
          }),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const authData = await authResponse.json();

        if (authData.error) throw new Error('Invalid Credentials or Account Revoked');

        // Fetch database access
        const dbUrl =
          'https://firestore.googleapis.com/v1/projects/' +
          FIREBASE_PROJECT_ID +
          '/databases/(default)/documents/security/app_keys';

        const dbResponse = await fetch(dbUrl, {
          headers: {
            Authorization: 'Bearer ' + authData.idToken
          }
        });

        const dbData = await dbResponse.json();

        if (dbData.error) {
          console.error('Firestore error:', dbData.error);
          throw new Error('Database Access Denied: ' + JSON.stringify(dbData.error));
        }

        // Check if fields exist
        if (!dbData.fields || !dbData.fields.secretTargetKey) {
          console.error('secretTargetKey not found in Firestore response:', dbData);
          throw new Error('Missing secretTargetKey in database. Contact admin.');
        }

        const secretKey = dbData.fields.secretTargetKey.stringValue;

        if (!secretKey) {
          throw new Error('secretTargetKey value is empty');
        }

        chrome.storage.local.set(
          {
            secretTargetKey: secretKey,
            refreshToken: authData.refreshToken,
            botEnabled: true
          },
          () => {
            console.log('✅ Login successful, stored secretTargetKey:', secretKey);
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('appScreen').style.display = 'block';
            loadAppUI({});
          }
        );
      } catch (error) {
        loginBtn.innerText = 'Access Account';
        errorDiv.innerText = error.message;
        errorDiv.style.display = 'block';
      }
    });
  }

  // Logout button click handler
  if (document.getElementById('logoutBtn')) {
    document.getElementById('logoutBtn').addEventListener('click', () => {
      chrome.storage.local.remove(['secretTargetKey', 'refreshToken'], () => {
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('appScreen').style.display = 'none';
        document.getElementById('passInput').value = '';
        document.getElementById('emailInput').value = '';
      });
    });
  }

  // Medicine sort change handler
  if (document.getElementById('medSort')) {
    document.getElementById('medSort').addEventListener('change', (event) => {
      renderCheckboxes(
        'medicineList',
        availableMedicines,
        getChecked('med'),
        'med',
        event.target.value
      );
      saveAllData();
    });
  }

  // Country sort change handler
  if (document.getElementById('countrySort')) {
    document.getElementById('countrySort').addEventListener('change', (event) => {
      renderCheckboxes('countryList', availableCountries, getChecked('ctry'), 'ctry', event.target.value);
      saveAllData();
    });
  }

  // Rule sort change handler
  if (document.getElementById('ruleSort')) {
    document.getElementById('ruleSort').addEventListener('change', (event) => {
      renderCheckboxes('ruleList', availableRules, getChecked('rule'), 'rule', event.target.value);
      saveAllData();
    });
  }

  // Bot status toggle handler
  if (document.getElementById('botEnabled')) {
    document.getElementById('botEnabled').addEventListener('change', (event) => {
      updateStatusText(event.target.checked);
      saveAllData(); // ✅ ADDED: Save when toggling bot status
    });
  }

  // Add medicine button click handler
  if (document.getElementById('addMedicineBtn')) {
    document.getElementById('addMedicineBtn').addEventListener('click', () => {
    let newMedicine = document.getElementById('newMedicine').value.trim();
    if (newMedicine && !availableMedicines.includes(newMedicine)) {
      availableMedicines.push(newMedicine);
      document.getElementById('newMedicine').value = '';
      renderCheckboxes(
        'medicineList',
        availableMedicines,
        getChecked('med'),
        'med',
        document.getElementById('medSort').value
      );
      saveAllData(); // ✅ ADDED: Save after adding
    }
    });
  }

  // Add country button click handler
  if (document.getElementById('addCountryBtn')) {
    document.getElementById('addCountryBtn').addEventListener('click', () => {
      let newCountry = document.getElementById('newCountry').value.trim();
      if (newCountry && !availableCountries.includes(newCountry)) {
        availableCountries.push(newCountry);
        document.getElementById('newCountry').value = '';
        renderCheckboxes(
          'countryList',
          availableCountries,
          getChecked('ctry'),
          'ctry',
          document.getElementById('countrySort').value
        );
        saveAllData(); // ✅ ADDED: Save after adding
      }
    });
  }

  // Add rule button click handler
  if (document.getElementById('addRuleBtn')) {
    document.getElementById('addRuleBtn').addEventListener('click', () => {
    let ruleMedicine = document.getElementById('newRuleMed').value.trim();
    let ruleCountry = document.getElementById('newRuleCtry').value.trim();

    if (!ruleMedicine || !ruleCountry) return;

    const newRule = ruleMedicine + ' ➔ ' + ruleCountry;
    if (!availableRules.includes(newRule)) {
      availableRules.push(newRule);
      document.getElementById('newRuleMed').value = '';
      document.getElementById('newRuleCtry').value = '';
      renderCheckboxes(
        'ruleList',
        availableRules,
        getChecked('rule'),
        'rule',
        document.getElementById('ruleSort').value
      );
      saveAllData(); // ✅ ADDED: Save after adding
      }
    });
  }

  // Save button click handler - ✅ ONLY THIS SHOWS POPUP
  if (document.getElementById('saveBtn')) {
    document.getElementById('saveBtn').addEventListener('click', () => {
      saveAllData();
      showSaveNotification();
    });
  }

});

// Load app UI with saved data
function loadAppUI(savedData) {
  if (savedData.botEnabled !== undefined) {
    document.getElementById('botEnabled').checked = savedData.botEnabled;
    updateStatusText(savedData.botEnabled);
  } else {
    updateStatusText(false); // ✅ ADDED: Default to inactive
  }

  if (savedData.mobileOnly !== undefined) {
    document.getElementById('mobileOnly').checked = savedData.mobileOnly; // ✅ FIXED: Use checked instead of innerText
  }

  if (savedData.autoRefresh !== undefined) {
    document.getElementById('autoRefresh').checked = savedData.autoRefresh; // ✅ FIXED: Use checked instead of innerText
  }

  if (savedData.refreshInterval !== undefined) {
    document.getElementById('refreshInterval').value = savedData.refreshInterval;
  }

  if (savedData.savedMedicines) {
    availableMedicines = savedData.savedMedicines;
  }

  if (savedData.savedCountries) {
    availableCountries = savedData.savedCountries;
  }

  if (savedData.savedRules) {
    availableRules = savedData.savedRules;
  }

  if (savedData.medSort) {
    document.getElementById('medSort').value = savedData.medSort;
  }

  if (savedData.countrySort) {
    document.getElementById('countrySort').value = savedData.countrySort;
  }

  if (savedData.ruleSort) {
    document.getElementById('ruleSort').value = savedData.ruleSort;
  }

  let selectedMedicines = savedData.selectedMedicines || [];
  let selectedCountries = savedData.selectedCountries || [];
  let selectedRules = savedData.selectedRules || [];

  renderCheckboxes('medicineList', availableMedicines, selectedMedicines, 'med', document.getElementById('medSort').value);
  renderCheckboxes('countryList', availableCountries, selectedCountries, 'ctry', document.getElementById('countrySort').value);
  renderCheckboxes('ruleList', availableRules, selectedRules, 'rule', document.getElementById('ruleSort').value);
  
  // ✅ ADDED: Update status dot based on bot status
  const statusDot = document.getElementById('statusDot');
  if (statusDot) {
    if (savedData.botEnabled) {
      statusDot.classList.add('active');
    } else {
      statusDot.classList.remove('active');
    }
  }
}

// Render checkboxes with sorting options
function renderCheckboxes(containerId, itemsArray, checkedItems, dataType, sortType) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  let sortedItems = [...itemsArray];

  if (sortType === 'az') {
    sortedItems.sort((a, b) => a.localeCompare(b));
  } else if (sortType === 'za') {
    sortedItems.sort((a, b) => b.localeCompare(a));
  } else if (sortType === 'recent') {
    sortedItems.reverse();
  } else if (sortType === 'selected') {
    sortedItems.sort((a, b) => {
      let aChecked = checkedItems.includes(a);
      let bChecked = checkedItems.includes(b);
      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      return a.localeCompare(b);
    });
  }

  sortedItems.forEach((item, index) => {
    const isChecked = checkedItems.includes(item) ? 'checked' : '';
    const checkboxHtml =
      '<div class="checkbox-item">' +
      '<div class="checkbox-left">' +
      '<input type="checkbox" id="' +
      dataType +
      '_' +
      index +
      '" value="' +
      item +
      '" class="' +
      dataType +
      '-checkbox" ' +
      isChecked +
      ' style="margin:0; font-weight:normal;">' +
      '<label for="' +
      dataType +
      '_' +
      index +
      '" class="' +
      dataType +
      '-checkbox">' +
      item +
      '</label>' +
      '</div>' +
      '<span class="delete-btn" data-val="' +
      item +
      '" data-type="' +
      dataType +
      '" title="Delete">✖</span>' +
      '</div>';

    container.insertAdjacentHTML('beforeend', checkboxHtml);
  });

  const deleteButtons = container.querySelectorAll('.delete-btn');
  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const itemValue = event.target.getAttribute('data-val');
      const itemType = event.target.getAttribute('data-type');

      if (itemType === 'med') {
        availableMedicines = availableMedicines.filter((item) => item !== itemValue);
      } else if (itemType === 'ctry') {
        availableCountries = availableCountries.filter((item) => item !== itemValue);
      } else if (itemType === 'rule') {
        availableRules = availableRules.filter((item) => item !== itemValue);
      }

      renderCheckboxes(
        containerId,
        itemType === 'med' ? availableMedicines : itemType === 'ctry' ? availableCountries : availableRules,
        getChecked(itemType),
        itemType,
        document.getElementById(itemType + 'Sort').value
      );

      saveAllData();
    });
  });

  // ✅ ADDED: Attach checkbox listeners to save data when checked/unchecked
  const allCheckboxes = container.querySelectorAll('input[type="checkbox"]');
  allCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      saveAllData();
    });
  });
}

// Save all data to Chrome storage
function saveAllData() {
  const selectedMedicinesArray = getChecked('med');
  const selectedCountriesArray = getChecked('ctry');
  const selectedRulesArray = getChecked('rule');

  const allData = {
    botEnabled: document.getElementById('botEnabled').checked,
    mobileOnly: document.getElementById('mobileOnly').checked,
    autoRefresh: document.getElementById('autoRefresh').checked,
    refreshInterval: parseInt(document.getElementById('refreshInterval').value) || 15,
    savedMedicines: availableMedicines,
    savedCountries: availableCountries,
    savedRules: availableRules,
    selectedMedicines: selectedMedicinesArray,
    selectedCountries: selectedCountriesArray,
    selectedRules: selectedRulesArray,
    // ✅ FIX: Also save FIRST selected item as singular for content.js compatibility
    selectedMedicine: selectedMedicinesArray.length > 0 ? selectedMedicinesArray[0] : '',
    selectedCountry: selectedCountriesArray.length > 0 ? selectedCountriesArray[0] : '',
    medSort: document.getElementById('medSort').value,
    countrySort: document.getElementById('countrySort').value,
    ruleSort: document.getElementById('ruleSort').value
  };

  console.log('💾 Saving configuration:', allData);

  chrome.storage.local.set(allData, () => {
    console.log('✅ Configuration saved to Chrome storage');
    console.log('📍 Selected Medicine:', allData.selectedMedicine);
    console.log('🌍 Selected Country:', allData.selectedCountry);
    
    // ✅ SHOW TOAST NOTIFICATION
    showSaveNotification();
    
    // Update status dot when bot enabled/disabled
    const statusDot = document.getElementById('statusDot');
    if (statusDot) {
      if (allData.botEnabled) {
        statusDot.classList.add('active');
      } else {
        statusDot.classList.remove('active');
      }
    }
  });
}

// ✅ NEW FUNCTION: Show save confirmation toast
function showSaveNotification() {
  // Remove old notification if exists
  const oldNotif = document.getElementById('saveNotification');
  if (oldNotif) oldNotif.remove();

  const notifDiv = document.createElement('div');
  notifDiv.id = 'saveNotification';
  notifDiv.style.cssText = `
    position: fixed;
    top: 15px;
    right: 15px;
    background: #4CAF50;
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  `;
  notifDiv.innerText = '✓ Configuration saved';
  document.body.appendChild(notifDiv);
  
  setTimeout(() => {
    if (notifDiv.parentNode) {
      notifDiv.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (notifDiv.parentNode) notifDiv.remove();
      }, 300);
    }
  }, 2000);
}

// Get all checked items
function getChecked(dataType) {
  const checkedElements = document.querySelectorAll('.' + dataType + '-checkbox:checked');
  return Array.from(checkedElements).map((el) => el.value);
}

// Update bot status text
function updateStatusText(isActive) {
  const statusText = document.getElementById('botStatusText');
  const statusDot = document.getElementById('statusDot');

  if (isActive) {
    statusText.innerText = 'Service Active';
    statusText.style.color = '#059669';
    statusText.style.fontWeight = '600';
    if (statusDot) statusDot.classList.add('active');
  } else {
    statusText.innerText = 'Service Inactive';
    statusText.style.color = '#dc2626';
    statusText.style.fontWeight = '600';
    if (statusDot) statusDot.classList.remove('active');
  }
}