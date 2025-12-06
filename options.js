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
let ocrOptionsStr = '';
let editingProfileId = null;

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
  const ocrOptionsTextarea = document.getElementById('ocr-options');
  const saveOcrBtn = document.getElementById('save-ocr-btn');
  const testOcrBtn = document.getElementById('test-ocr-btn');
  if (ocrInput) {
    ocrInput.addEventListener('input', (e) => { ocrUrl = e.target.value.trim(); });
  }
  if (ocrOptionsTextarea) {
    ocrOptionsTextarea.addEventListener('input', (e) => { ocrOptionsStr = e.target.value; });
  }
  if (saveOcrBtn) saveOcrBtn.addEventListener('click', saveOcrUrl);
  if (testOcrBtn) testOcrBtn.addEventListener('click', testOcrEndpoint);
  const exportBtn = document.getElementById('export-profiles-btn');
  const importBtn = document.getElementById('import-profiles-btn');
  const importInput = document.getElementById('import-profiles-input');
  if (exportBtn) exportBtn.addEventListener('click', exportProfiles);
  if (importBtn) importBtn.addEventListener('click', () => importInput && importInput.click());
  if (importInput) importInput.addEventListener('change', handleImportFile);
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
    // load ocr options
    const r3 = await chrome.storage.sync.get('ocrOptions');
    ocrOptionsStr = r3.ocrOptions || '';
    const ocrOptionsTextarea = document.getElementById('ocr-options');
    if (ocrOptionsTextarea) ocrOptionsTextarea.value = ocrOptionsStr;
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
  const systemPrompt = document.getElementById('profile-system-prompt').value.trim();

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

    // Check for duplicate profile name
    if (profiles.some(p => p.name.toLowerCase() === profileName.toLowerCase() && p.id !== editingProfileId)) {
      showError('A profile with this name already exists');
      return;
    }

    if (editingProfileId) {
      // update existing
      const idx = profiles.findIndex(p => p.id === editingProfileId);
      if (idx !== -1) {
        profiles[idx].name = profileName;
        profiles[idx].url = normalizedUrl;
        profiles[idx].systemPrompt = systemPrompt || '';
        profiles[idx].updatedAt = new Date().toISOString();
      }
      editingProfileId = null;
      document.getElementById('add-profile-btn').textContent = 'Add Profile';
    } else {
      // Check if profile URL exists
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
        systemPrompt: systemPrompt || '',
        createdAt: new Date().toISOString()
      };

      profiles.push(newProfile);
    }
    await saveProfiles();

    // Clear inputs
    document.getElementById('profile-name').value = '';
    document.getElementById('profile-url').value = '';
    document.getElementById('profile-system-prompt').value = '';

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
 * Edit profile - populate the form for editing
 */
function editProfile(profileId) {
  const prof = profiles.find(p => p.id === profileId);
  if (!prof) return;
  document.getElementById('profile-name').value = prof.name || '';
  document.getElementById('profile-url').value = prof.url || '';
  document.getElementById('profile-system-prompt').value = prof.systemPrompt || '';
  editingProfileId = prof.id;
  document.getElementById('add-profile-btn').textContent = 'Save Profile';
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
        <button class="profile-action-btn profile-edit-btn" data-id="${profile.id}">Edit</button>
        <button class="profile-action-btn profile-delete-btn" data-id="${profile.id}">Delete</button>
      </div>
    `;

    profileCard.querySelector('.profile-delete-btn').addEventListener('click', (e) => {
      deleteProfile(e.target.dataset.id);
    });
    profileCard.querySelector('.profile-edit-btn').addEventListener('click', (e) => {
      editProfile(e.target.dataset.id);
    });

    profilesItems.appendChild(profileCard);
  });
}

/**
 * Export profiles to a JSON file for import elsewhere
 */
function exportProfiles() {
  const data = JSON.stringify(profiles, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'profiles.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Handle import file selection
 */
function handleImportFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 2000000) { // 2MB limit
    showError('Import file too large (max 2MB)');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!Array.isArray(parsed)) {
        showError('Import file must be an array of profiles');
        return;
      }
      // validate and merge
      let added = 0, skipped = 0;
      parsed.forEach(p => {
        if (!p || typeof p.name !== 'string' || !p.name.trim()) { skipped++; return; }
        if (profiles.some(existing => existing.name.toLowerCase() === p.name.trim().toLowerCase())) { skipped++; return; }
        const newP = {
          id: Date.now().toString() + Math.floor(Math.random()*1000),
          name: p.name.trim(),
          url: (p.url||'').trim(),
          models: p.models || [],
          systemPrompt: p.systemPrompt || '',
          createdAt: new Date().toISOString()
        };
        profiles.push(newP);
        added++;
      });
      saveProfiles().then(() => {
        renderProfiles();
        loadActiveProfileSelection();
        showStatus(`Imported ${added} profiles, skipped ${skipped}`);
        clearMessages();
      });
    } catch (err) {
      showError('Failed to parse import file: ' + err.message);
    }
  };
  reader.readAsText(file);
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
    // validate ocrOptionsStr is valid JSON (if not empty)
    if (ocrOptionsStr && ocrOptionsStr.trim().length > 0) {
      try {
        JSON.parse(ocrOptionsStr);
      } catch (err) {
        showError('OCR Options must be valid JSON: ' + err.message);
        return;
      }
    }

    await chrome.storage.sync.set({ ocrUrl: ocrUrl, ocrOptions: ocrOptionsStr });
    showStatus('✓ OCR settings saved!');
    clearMessages();
  } catch (error) {
    showError(`Failed to save OCR settings: ${error.message}`);
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
