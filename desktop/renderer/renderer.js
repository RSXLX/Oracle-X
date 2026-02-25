const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const profileInput = document.getElementById('profile');
const enableNoFomoBlockInput = document.getElementById('enableNoFomoBlock');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');

async function init() {
  const settings = await window.oracleDesktop.getSettings();
  apiBaseUrlInput.value = settings.apiBaseUrl || 'http://localhost:3000';
  profileInput.value = settings.profile || 'balanced';
  enableNoFomoBlockInput.checked = Boolean(settings.enableNoFomoBlock);
}

saveBtn.addEventListener('click', async () => {
  await window.oracleDesktop.saveSettings({
    apiBaseUrl: apiBaseUrlInput.value.trim(),
    profile: profileInput.value,
    enableNoFomoBlock: enableNoFomoBlockInput.checked,
  });
  saveStatus.textContent = `已保存（${new Date().toLocaleTimeString()}）`;
});

init();
