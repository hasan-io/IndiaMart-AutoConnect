// ==========================================
// NEXUS LEAD SNIPER - Content Script v4.1
// Fixed: Country & Medicine Extraction
// ==========================================

const FIREBASE_API_KEY = "AIzaSyATjm5ngvh5qmBlBnS_hLh6mjhn_uMeCHs";
const FIREBASE_PROJECT_ID = "lead-connect-df1c8";

let autoRefreshTimer = null;

// Initialize on page load
console.log('IndiaMart Lead Sniper: Initialized (Vault Secured Mode).');

chrome.storage.local.get(['selectedCountry', 'selectedMedicine', 'isRunning'], (data) => {
  const selectedCountry = data.selectedCountry || 'Canada';
  const selectedMedicine = data.selectedMedicine || 'Tretinoin';
  const isRunning = data.isRunning !== false;

  if (!isRunning) {
    console.log('🛑 Bot is OFF');
    return;
  }

  console.log('🤖 NEXUS LEAD SNIPER - ACTIVE');
  console.log('📍 Looking for:', selectedMedicine, 'in', selectedCountry);

  // Monitor for new lead cards
  const observer = new MutationObserver(() => {
    processLeads(selectedCountry, selectedMedicine);
  });

  observer.observe(document.body, {
  childList: true,
  subtree: true,
});

  // Process existing leads
  processLeads(selectedCountry, selectedMedicine);
});

// ==========================================
// MAIN FUNCTION: Process All Leads
// ==========================================
function processLeads(selectedCountry, selectedMedicine) {
  const cards = document.querySelectorAll('[id^="BLCard"]');

  if (cards.length === 0) {
    console.log('⚠️ No lead cards found');
    return;
  }

  console.log(`\n📋 Found ${cards.length} lead cards. Processing...`);

  cards.forEach((card, index) => {
    try {
      // ✅ FIX 1: CORRECT MEDICINE SELECTOR
      // Portal HTML: <span class="SLC_f18 SLC_fwb">Tretinoin Cream 0.025%</span>
      const medicineElement = card.querySelector('span.SLC_f18.SLC_fwb');
      const medicineName = medicineElement?.innerText?.trim() || 'Unknown';

      // ✅ FIX 2: CORRECT COUNTRY SELECTOR
      // Portal HTML: <span class="BuyldC_lh">2 hrs ago  Canada</span>
      const countrySpan = card.querySelector('strong.BuyLC_tltpw');
      const countryFullText = countrySpan?.innerText?.trim() || '';
      const countryName = extractCountry(countryFullText);

      // ✅ BUTTON SELECTOR (Already correct in original)
      const button = card.querySelector('button.SLC_FillCTA');
      const buttonExists = !!button;

      // ==========================================
      // DEBUG LOGS
      // ==========================================
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📌 Card #${index + 1} [${card.id}]`);
      console.log(`${'='.repeat(50)}`);
      console.log(`💊 Medicine Extracted: "${medicineName}"`);
      console.log(`🌍 Country Extracted: "${countryName}"`);
      console.log(`🔘 Button Available: ${buttonExists}`);
      console.log(`\n🔍 Matching Criteria:`);
      console.log(`   ✓ Expected Medicine: "${selectedMedicine}"`);
      console.log(`   ✓ Expected Country: "${selectedCountry}"`);

      // ==========================================
      // MATCHING LOGIC
      // ==========================================
      const medicineMatches = medicineName
        .toLowerCase()
        .includes(selectedMedicine.toLowerCase());
      
      const countryMatches = countryName
        .toLowerCase()
        .trim() === selectedCountry.toLowerCase().trim();

      console.log(`\n📊 Match Results:`);
      console.log(`   ${medicineMatches ? '✅' : '❌'} Medicine Match: ${medicineMatches}`);
      console.log(`   ${countryMatches ? '✅' : '❌'} Country Match: ${countryMatches}`);

      // ==========================================
      // ACTION: Click Button if Match
      // ==========================================
      if (medicineMatches && countryMatches && buttonExists) {
        console.log(`\n🎯 PERFECT MATCH! CLICKING BUTTON...`);
        
        // Visual feedback
        card.style.border = '3px solid #00ff00';
        card.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.8)';
        card.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';

        // Click button
        button.click();

        console.log(`✅ CLICKED: ${medicineName} | ${countryName}`);
        console.log(`${'='.repeat(50)}\n`);

        // Add delay to avoid rapid clicks
        setTimeout(() => {
          console.log('⏳ Waiting 2 seconds before next card...');
        }, 2000);
      } else {
        // No match - show why
        if (!medicineMatches) {
          console.log(`❌ SKIP: Medicine doesn't match`);
        }
        if (!countryMatches) {
          console.log(`❌ SKIP: Country doesn't match`);
        }
        if (!buttonExists) {
          console.log(`❌ SKIP: Button not found`);
        }
        console.log(`${'='.repeat(50)}\n`);
      }
    } catch (error) {
      console.error(`❌ Error processing card ${index + 1}:`, error);
    }
  });
}

// ==========================================
// HELPER FUNCTION: Extract Country
// ==========================================
function extractCountry(text) {
  // Input format: "2 hrs ago  Canada" or "22 mins ago  🇨🇦 Canada"
  // Output: "Canada"

  if (!text || text.trim() === '') {
    return 'Unknown';
  }

  // List of common countries (Add more as needed)
  const countries = [
    'Canada',
    'USA',
    'United States',
    'UK',
    'United Kingdom',
    'Spain',
    'France',
    'Germany',
    'Italy',
    'Australia',
    'India',
    'China',
    'Japan',
    'Brazil',
    'Mexico',
    'Netherlands',
    'Belgium',
    'Switzerland',
    'Sweden',
    'Norway',
    'Poland',
    'Greece',
    'Portugal',
    'Austria',
    'Czech Republic',
    'Denmark',
    'Finland',
    'Ireland',
    'New Zealand',
  ];

  // Search for known country in text
  for (let country of countries) {
    if (text.includes(country)) {
      return country;
    }
  }

  // If no known country found, try to extract last word
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lastWord = words[words.length - 1];

  // Return last word if it looks like a country (2+ characters, no numbers)
  if (
    lastWord &&
    lastWord.length > 2 &&
    !lastWord.match(/^\d+/) &&
    !lastWord.match(/ago|hrs|mins/)
  ) {
    return lastWord;
  }

  return 'Unknown';
}

// ==========================================
// LISTEN FOR STORAGE CHANGES
// ==========================================
// When user changes settings in popup, re-run the bot
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.isRunning || changes.selectedCountry || changes.selectedMedicine) {
      console.log('🔄 Settings updated! Reprocessing leads...');

      chrome.storage.local.get(
        ['selectedCountry', 'selectedMedicine', 'isRunning'],
        (data) => {
          const selectedCountry = data.selectedCountry || 'Canada';
          const selectedMedicine = data.selectedMedicine || 'Tretinoin';
          const isRunning = data.isRunning !== false;

          if (isRunning) {
            processLeads(selectedCountry, selectedMedicine);
          }
        }
      );
    }
  }
});

console.log('✅ Content Script Loaded Successfully!');