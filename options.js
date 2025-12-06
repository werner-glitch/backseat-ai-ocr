/**
 * Options Script
 * Handles server profiles management and model selection
 */

document.addEventListener('DOMContentLoaded', init);

// Global state
let profiles = [];
let currentSelectedProfile = null;
let availableModels = [];
let ocrUrl = '';

/**
 * Initialize options page
 */
async function init() {
  // Load profiles from storage
  await loadProfiles();
  renderProfiles();
  loadActiveProfileSelection();

  // Setup event listeners
  document.getElementById('add-profile-btn').addEventListener('click', addProfile);
  document.getElementById('fetch-models-btn').addEventListener('click', fetchModels);
  document.getElementById('active-profile').addEventListener('change', onActiveProfileChanged);
  document.getElementById('save-profile-selection-btn').addEventListener('click', saveProfileSelection);
  // OCR buttons
  const ocrInput = document.getElementById('ocr-url');
  const saveOcrBtn = document.getElementById('save-ocr-btn');
  const testOcrBtn = document.getElementById('test-ocr-btn');
  if (ocrInput) {
    ocrInput.addEventListener('input', (e) => { ocrUrl = e.target.value.trim(); });
  }
  if (saveOcrBtn) saveOcrBtn.addEventListener('click', saveOcrUrl);
  if (testOcrBtn) testOcrBtn.addEventListener('click', testOcrEndpoint);
}

/**
 * Load profiles from chrome.storage
 */
async function loadProfiles() {
  try {
    const result = await chrome.storage.sync.get('profiles');
    profiles = result.profiles || [];
  } catch (error) {
    console.error('Error loading profiles:', error);
    profiles = [];
  }
  // Load OCR URL if present
  try {
    const r2 = await chrome.storage.sync.get('ocrUrl');
    ocrUrl = r2.ocrUrl || '';
    const ocrInput = document.getElementById('ocr-url');
    if (ocrInput) ocrInput.value = ocrUrl;
  } catch (e) {
    console.warn('Failed to load ocrUrl:', e);
  }
}

/**
 * Save profiles to chrome.storage
 */
async function saveProfiles() {
  try {
    await chrome.storage.sync.set({ profiles: profiles });
  } catch (error) {
    showError(`Failed to save profiles: ${error.message}`);
  }
}

/**
 * Add a new profile
 */
async function addProfile() {
  const profileName = document.getElementById('profile-name').value.trim();
  const profileUrl = document.getElementById('profile-url').value.trim();

  if (!profileName) {
    showError('Please enter a profile name');
    return;
  }

  if (!profileUrl) {
    showError('Please enter a server URL');
    return;
  }

  // Validate URL format
  try {
    const url = new URL(profileUrl);
    // Normalize URL (remove trailing slash)
    const normalizedUrl = url.origin + url.pathname.replace(/\/$/, '');
    
    // Check if profile already exists
    if (profiles.some(p => p.url === normalizedUrl)) {
      showError('This profile URL already exists');
      return;
    }

    // Add new profile
    const newProfile = {
      id: Date.now().toString(),
      name: profileName,
      url: normalizedUrl,
      models: [],
      createdAt: new Date().toISOString()
    };

    profiles.push(newProfile);
    await saveProfiles();

    // Clear inputs
    document.getElementById('profile-name').value = '';
    document.getElementById('profile-url').value = '';

    // Update UI
    renderProfiles();
    loadActiveProfileSelection();
    showStatus('✓ Profile added successfully!');
    clearMessages();
  } catch (error) {
    showError('Invalid URL format. Please enter a valid server URL.');
  }
}

/**
 * Delete a profile
 */
async function deleteProfile(profileId) {
  if (!confirm('Are you sure you want to delete this profile?')) {
    return;
  }

  profiles = profiles.filter(p => p.id !== profileId);
  await saveProfiles();

  // Reset selection if deleted profile was active
  const activeProfile = document.getElementById('active-profile').value;
  if (activeProfile === profileId) {
    await chrome.storage.sync.set({ 
      activeProfile: '',
      selectedModel: ''
    });
  }

  renderProfiles();
  loadActiveProfileSelection();
  showStatus('✓ Profile deleted');
  clearMessages();
}

/**
 * Render profiles list
 */
function renderProfiles() {
  const profilesList = document.getElementById('profiles-list');
  const profilesItems = document.getElementById('profiles-items');

  if (profiles.length === 0) {
    profilesList.style.display = 'none';
    return;
  }

  profilesList.style.display = 'block';
  profilesItems.innerHTML = '';

  profiles.forEach(profile => {
    const profileCard = document.createElement('div');
    profileCard.className = 'profile-card';

    const modelsCount = profile.models ? profile.models.length : 0;
    const statusText = modelsCount > 0 
      ? `${modelsCount} model${modelsCount !== 1 ? 's' : ''} available`
      : 'Models not fetched';

    profileCard.innerHTML = `
      <div class="profile-info">
        <div class="profile-name">${escapeHtml(profile.name)}</div>
        <div class="profile-url">${escapeHtml(profile.url)}</div>
        <div class="profile-status">${statusText}</div>
      </div>
      <div class="profile-actions">
        <button class="profile-action-btn profile-delete-btn" data-id="${profile.id}">Delete</button>
      </div>
    `;

    profileCard.querySelector('.profile-delete-btn').addEventListener('click', (e) => {
      deleteProfile(e.target.dataset.id);
    });

    profilesItems.appendChild(profileCard);
  });
}

/**
 * Load and display active profile selection
 */
async function loadActiveProfileSelection() {
  const select = document.getElementById('active-profile');
  select.innerHTML = '<option value="">-- No profile selected --</option>';

  profiles.forEach(profile => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    select.appendChild(option);
  });

  // Load saved active profile
  try {
    const result = await chrome.storage.sync.get(['activeProfile', 'selectedModel']);
    if (result.activeProfile) {
      select.value = result.activeProfile;
      currentSelectedProfile = result.activeProfile;
      
      // Load models for this profile
      const profile = profiles.find(p => p.id === result.activeProfile);
      if (profile && profile.models && profile.models.length > 0) {
        updateModelDropdown(profile.models, result.selectedModel);
      }
    }
  } catch (error) {
    console.error('Error loading active profile:', error);
  }
}

/**
 * Handle active profile change
 */
async function onActiveProfileChanged(e) {
  currentSelectedProfile = e.target.value;
  
  if (!currentSelectedProfile) {
    updateModelDropdown([], '');
    return;
  }

  const profile = profiles.find(p => p.id === currentSelectedProfile);
  if (profile && profile.models && profile.models.length > 0) {
    updateModelDropdown(profile.models);
  } else {
    updateModelDropdown([], '');
  }
}

/**
 * Fetch available models from Ollama-compatible server
 */
async function fetchModels() {
  if (!currentSelectedProfile) {
    showError('Please select a profile first');
    return;
  }

  const profile = profiles.find(p => p.id === currentSelectedProfile);
  if (!profile) {
    showError('Profile not found');
    return;
  }

  showTestLoading();

  try {
    // Construct API URL for fetching tags/models
    const tagsUrl = `${profile.url}/api/tags`;
    
    const response = await fetch(tagsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract model names from response
    let models = [];
    if (data.models && Array.isArray(data.models)) {
      models = data.models.map(m => m.name || m.model || m);
    } else if (Array.isArray(data)) {
      models = data;
    }

    if (models.length === 0) {
      showTestResult('error', {
        error: 'No models found on this server'
      });
      return;
    }

    // Update profile with fetched models
    profile.models = models;
    await saveProfiles();

    // Update UI
    updateModelDropdown(models);
    renderProfiles();
    showTestResult('success', {
      status: 200,
      statusText: 'Models fetched successfully',
      response: {
        modelsFound: models.length,
        models: models
      }
    });
  } catch (error) {
    showTestResult('error', {
      error: `Failed to fetch models: ${error.message}`
    });
  }
}

/**
 * Update model dropdown with available models
 */
function updateModelDropdown(models, selectedModel = '') {
  const modelSelect = document.getElementById('selected-model');
  
  modelSelect.innerHTML = '<option value="">-- Select a model --</option>';
  
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });

  if (selectedModel && models.includes(selectedModel)) {
    modelSelect.value = selectedModel;
  }

  if (models.length === 0) {
    document.getElementById('model-help').textContent = 
      'Select a profile and click "Fetch Models" to populate this list.';
  } else {
    document.getElementById('model-help').textContent = 
      `${models.length} model${models.length !== 1 ? 's' : ''} available`;
  }
}

/**
 * Save active profile and model selection
 */
async function saveProfileSelection() {
  const activeProfile = document.getElementById('active-profile').value;
  const selectedModel = document.getElementById('selected-model').value;

  if (!activeProfile) {
    showError('Please select a profile');
    return;
  }

  if (!selectedModel) {
    showError('Please select a model');
    return;
  }

  try {
    await chrome.storage.sync.set({
      activeProfile: activeProfile,
      selectedModel: selectedModel
    });
    showStatus('✓ Profile and model selection saved!');
    clearMessages();
  } catch (error) {
    showError(`Failed to save selection: ${error.message}`);
  }
}

/**
 * Save OCR URL to storage
 */
async function saveOcrUrl() {
  try {
    await chrome.storage.sync.set({ ocrUrl: ocrUrl });
    showStatus('✓ OCR URL saved!');
    clearMessages();
  } catch (error) {
    showError(`Failed to save OCR URL: ${error.message}`);
  }
}

/**
 * Test OCR endpoint by sending a simple GET request (ping)
 */
async function testOcrEndpoint() {
  if (!ocrUrl) {
    showError('Please enter an OCR URL first');
    return;
  }

  const elem = document.getElementById('test-result');
  elem.style.display = 'block';
  elem.innerHTML = '<p>Testing OCR endpoint...</p>';

  try {
    const resp = await fetch(ocrUrl, { method: 'GET' });
    if (!resp.ok) {
      showTestResult('error', { error: `HTTP ${resp.status}: ${resp.statusText}` });
      return;
    }

    // Try parsing JSON to give better feedback
    let data = null;
    try { data = await resp.json(); } catch (e) { data = null; }

    showTestResult('success', {
      status: resp.status,
      statusText: 'OCR endpoint reachable',
      response: data || 'No JSON response'
    });
  } catch (error) {
    showTestResult('error', { error: error.message });
  }
}

/**
 * Display success status message
 */
function showStatus(message) {
  const elem = document.getElementById('status-message');
  elem.textContent = message;
  elem.style.display = 'block';
  elem.style.color = 'green';
}

/**
 * Display error message
 */
function showError(message) {
  const elem = document.getElementById('error-message');
  elem.textContent = message;
  elem.style.display = 'block';
}

/**
 * Show test result
 */
function showTestResult(type, data) {
  const elem = document.getElementById('test-result');
  
  if (type === 'success') {
    elem.innerHTML = `
      <h3 style="color: green;">✓ ${data.statusText}</h3>
      <p><strong>Status:</strong> ${data.status}</p>
      <details>
        <summary>Response Data</summary>
        <pre>${JSON.stringify(data.response, null, 2)}</pre>
      </details>
    `;
  } else {
    elem.innerHTML = `
      <h3 style="color: red;">✗ Error</h3>
      <p><strong>Error:</strong> ${data.error}</p>
    `;
  }

  elem.style.display = 'block';
}

/**
 * Show loading state
 */
function showTestLoading() {
  const elem = document.getElementById('test-result');
  elem.innerHTML = '<p>Fetching models...</p>';
  elem.style.display = 'block';
}

/**
 * Clear error/status messages after delay
 */
function clearMessages() {
  setTimeout(() => {
    document.getElementById('status-message').style.display = 'none';
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('test-result').style.display = 'none';
  }, 4000);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
