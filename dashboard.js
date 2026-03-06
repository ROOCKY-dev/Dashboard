// Utility function to escape HTML and prevent XSS
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

let currentSettings = {};

const DEFAULT_SETTINGS = {
    username: 'Roocky dev',
    darkMode: true,
    modules: {
        quickAccess: true,
        tasks: true,
        hn: true,
        gnews: true,
        gmail: true
    },
    apiKeys: {
        gnews: ''
    },
    weather: {
        lat: '2.9935',
        lon: '101.7874',
        name: 'Kajang, MY'
    },
    quickAccess: [
        { title: 'Gmail', url: '#', icon: 'mail' },
        { title: 'UNITEN', url: '#', icon: 'school' },
        { title: 'GitHub', url: '#', icon: 'code' },
        { title: 'MC Server', url: '#', icon: 'dns' },
        { title: 'Figma', url: '#', icon: 'draw' }
    ]
};

async function loadSettings() {
    try {
        const result = await browser.storage.local.get(['dashboardSettings']);
        if (result.dashboardSettings) {
            // Merge defaults with loaded settings in case new settings were added
            currentSettings = {
                ...DEFAULT_SETTINGS,
                ...result.dashboardSettings,
                modules: { ...DEFAULT_SETTINGS.modules, ...(result.dashboardSettings.modules || {}) },
                apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...(result.dashboardSettings.apiKeys || {}) },
                weather: { ...DEFAULT_SETTINGS.weather, ...(result.dashboardSettings.weather || {}) }
            };
        } else {
            currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            await browser.storage.local.set({ dashboardSettings: currentSettings });
        }
    } catch (e) {
        console.warn('Could not load settings from browser.storage, using defaults', e);
        currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
}

function applySettingsToDOM() {
    // 1. Theme
    const htmlEl = document.documentElement;
    if (currentSettings.darkMode) {
        htmlEl.classList.add('dark');
    } else {
        htmlEl.classList.remove('dark');
    }

    // 2. Username
    const greetingEl = document.getElementById('greeting-text');
    if (greetingEl) {
        greetingEl.textContent = `Welcome Back, ${currentSettings.username}`;
    }

    // 3. Module Visibility
    const toggleModule = (id, isVisible) => {
        const el = document.getElementById(id);
        if (el) el.style.display = isVisible ? '' : 'none';
    };

    toggleModule('module-quick-access', currentSettings.modules.quickAccess);
    toggleModule('module-tasks', currentSettings.modules.tasks);
    toggleModule('module-hn', currentSettings.modules.hn);
    toggleModule('module-gnews', currentSettings.modules.gnews);
    toggleModule('module-gmail', currentSettings.modules.gmail);

    // 4. Quick Access Links
    if (currentSettings.modules.quickAccess) {
        const qaListEl = document.getElementById('quick-access-list');
        if (qaListEl) {
            qaListEl.innerHTML = '';
            currentSettings.quickAccess.forEach(item => {
                const a = document.createElement('a');
                a.href = escapeHTML(item.url);
                a.className = 'flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md p-4 items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-primary/50 transition-all group';
                a.innerHTML = `
                    <div class="text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">
                        <span class="material-symbols-outlined text-3xl">${escapeHTML(item.icon)}</span>
                    </div>
                    <h2 class="text-slate-900 dark:text-white text-sm font-bold">${escapeHTML(item.title)}</h2>
                `;
                qaListEl.appendChild(a);
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    applySettingsToDOM();

    initDateTime();
    if (currentSettings.modules.weather !== false) initWeather(); // Weather doesn't have a distinct module toggle in HTML, but logic is here
    if (currentSettings.modules.tasks) initTasks();
    if (currentSettings.modules.hn) initHackerNews();
    if (currentSettings.modules.gnews) initGNews();
    if (currentSettings.modules.gmail) initGmail();

    initSettingsModal();
});

function initDateTime() {
    const datetimeEl = document.getElementById('datetime-text');
    if (!datetimeEl) return;

    const updateTime = () => {
        const now = new Date();
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        const dateStr = now.toLocaleDateString('en-US', options);
        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        datetimeEl.textContent = `${dateStr} | ${hours}:${minutes} ${ampm}`;
    };

    updateTime();
    setInterval(updateTime, 60000);
}

async function initWeather() {
    const weatherEl = document.getElementById('weather-text');
    if (!weatherEl) return;

    try {
        const { lat, lon, name } = currentSettings.weather;
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current_weather=true`);
        const data = await res.json();
        if (data && data.current_weather) {
            weatherEl.textContent = `${Math.round(data.current_weather.temperature)}°C, ${name}`;
        }
    } catch (err) {
        console.error('Failed to fetch weather', err);
    }
}

const DEFAULT_TASKS = [
    { id: 1, text: 'Build AI logic for Planetary Claim (Unity)', completed: false },
    { id: 2, text: 'Update Alto Clef Fork mining bot', completed: false },
    { id: 3, text: 'Wireframe Problem Marketplace', completed: false },
    { id: 4, text: 'Review CS assignments for UNITEN', completed: false }
];

async function initTasks() {
    const tasksListEl = document.getElementById('tasks-list');
    const newTaskInput = document.getElementById('new-task-input');

    if (!tasksListEl || !newTaskInput) return;

    let tasks = [];
    try {
        const result = await browser.storage.local.get(['tasks']);
        if (result.tasks && result.tasks.length > 0) {
            tasks = result.tasks;
        } else {
            tasks = [...DEFAULT_TASKS];
            await browser.storage.local.set({ tasks });
        }
    } catch (e) {
        // Fallback for non-extension environment
        tasks = [...DEFAULT_TASKS];
    }

    const renderTasks = () => {
        tasksListEl.innerHTML = '';
        tasks.forEach(task => {
            const label = document.createElement('label');
            label.className = 'flex items-start gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-lg cursor-pointer transition-colors';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-checkbox rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary w-5 h-5 bg-transparent mt-0.5';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', async () => {
                task.completed = checkbox.checked;
                await browser.storage.local.set({ tasks });
                renderTasks();
            });

            const span = document.createElement('span');
            span.className = `text-slate-700 dark:text-slate-300 text-sm font-medium select-none leading-snug ${task.completed ? 'line-through opacity-50' : ''}`;
            span.textContent = task.text;

            label.appendChild(checkbox);
            label.appendChild(span);
            tasksListEl.appendChild(label);
        });
    };

    newTaskInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && newTaskInput.value.trim() !== '') {
            tasks.push({
                id: Date.now(),
                text: newTaskInput.value.trim(),
                completed: false
            });
            newTaskInput.value = '';
            await browser.storage.local.set({ tasks });
            renderTasks();
        }
    });

    renderTasks();
}

async function initHackerNews() {
    const hnFeedEl = document.getElementById('hn-feed');
    if (!hnFeedEl) return;

    try {
        const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const topIds = await topRes.json();

        const top4Ids = topIds.slice(0, 4);
        const storyPromises = top4Ids.map(id => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.json()));
        const stories = await Promise.all(storyPromises);

        hnFeedEl.innerHTML = '';

        const gradients = [
            'from-primary/40 to-purple-500/40',
            'from-emerald-500/40 to-teal-500/40',
            'from-blue-500/40 to-cyan-500/40',
            'from-orange-500/40 to-red-500/40'
        ];

        stories.forEach((story, index) => {
            const timeAgo = Math.floor((Date.now() / 1000 - story.time) / 3600);
            const timeText = timeAgo > 0 ? `${timeAgo}h ago` : 'Just now';
            const gradient = gradients[index % gradients.length];

            const a = document.createElement('a');
            a.href = escapeHTML(story.url || `https://news.ycombinator.com/item?id=${story.id}`);
            a.target = '_blank';
            a.className = 'group flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md overflow-hidden hover:border-primary/50 transition-all';

            a.innerHTML = `
                <div class="h-32 bg-slate-200 dark:bg-slate-800 w-full relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-tr ${gradient} opacity-50 group-hover:scale-105 transition-transform duration-500"></div>
                    <span class="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">${escapeHTML(timeText)}</span>
                </div>
                <div class="p-4 flex flex-col gap-2">
                    <h5 class="text-slate-900 dark:text-white font-bold leading-snug group-hover:text-primary transition-colors line-clamp-2">${escapeHTML(story.title)}</h5>
                    <p class="text-slate-500 dark:text-slate-400 text-sm line-clamp-2">Score: ${escapeHTML(String(story.score))} | by ${escapeHTML(story.by)}</p>
                </div>
            `;
            hnFeedEl.appendChild(a);
        });

    } catch (err) {
        console.error('Failed to fetch HN', err);
    }
}

async function initGNews() {
    const gnewsFeedEl = document.getElementById('gnews-feed');
    if (!gnewsFeedEl) return;

    try {
        const API_KEY = currentSettings.apiKeys.gnews;
        if (!API_KEY) {
            gnewsFeedEl.innerHTML = '<div class="p-4 text-slate-500 text-sm">Please set GNews API Key in Settings</div>';
            return;
        }

        const res = await fetch(`https://gnews.io/api/v4/top-headlines?category=general&lang=en&max=2&apikey=${encodeURIComponent(API_KEY)}`);

        if (!res.ok) {
            throw new Error('GNews API requires a valid API key');
        }

        const data = await res.json();

        if (data.articles && data.articles.length > 0) {
            gnewsFeedEl.innerHTML = '';
            const gradients = [
                'from-blue-500/30 to-indigo-500/30',
                'from-orange-500/30 to-red-500/30'
            ];

            data.articles.forEach((article, index) => {
                const gradient = gradients[index % gradients.length];
                const publishedAt = new Date(article.publishedAt);
                const timeAgo = Math.floor((Date.now() - publishedAt.getTime()) / 3600000);
                const timeText = timeAgo > 0 ? `${timeAgo}h` : '1h';

                const a = document.createElement('a');
                a.href = escapeHTML(article.url);
                a.target = '_blank';
                a.className = 'group flex gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all items-center';

                a.innerHTML = `
                    <div class="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0 relative overflow-hidden">
                        ${article.image ? `<img src="${escapeHTML(article.image)}" class="w-full h-full object-cover opacity-80" />` : `<div class="absolute inset-0 bg-gradient-to-r ${gradient}"></div>`}
                    </div>
                    <div class="flex flex-col flex-1">
                        <h5 class="text-slate-900 dark:text-white font-bold text-sm group-hover:text-primary transition-colors line-clamp-2">${escapeHTML(article.title)}</h5>
                        <p class="text-slate-500 dark:text-slate-400 text-xs mt-1 line-clamp-1">${escapeHTML(article.description)}</p>
                    </div>
                    <span class="text-slate-400 text-xs whitespace-nowrap">${escapeHTML(timeText)}</span>
                `;
                gnewsFeedEl.appendChild(a);
            });
        }
    } catch (err) {
        console.warn('Failed to fetch GNews (likely missing API key), keeping fallback UI.', err);
    }
}

async function initGmail() {
    const unreadCountEl = document.getElementById('unread-count');
    const emailsListEl = document.getElementById('emails-list');

    if (!unreadCountEl || !emailsListEl) return;

    // Auth Flow for Gmail API
    // Need a valid client ID. This typically goes in manifest.json or constructed URL.
    // For this boilerplate we construct standard OAuth2 URL
    const CLIENT_ID = '646729790758-jjhef8luehd04p85qokm99epu7fhuqot.apps.googleusercontent.com';
    const REDIRECT_URI = browser.identity.getRedirectURL();
    const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

    const AUTH_URL = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}`;

    try {
        if (typeof browser === 'undefined' || !browser.identity) {
            throw new Error('browser.identity API not available');
        }

        const redirectUrl = await browser.identity.launchWebAuthFlow({
            url: AUTH_URL,
            interactive: false // Try silent auth first
        });

        const urlParams = new URLSearchParams(new URL(redirectUrl).hash.substring(1));
        const token = urlParams.get('access_token');

        if (token) {
            // Fetch unread count
            const messagesRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread in:inbox', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const messagesData = await messagesRes.json();
            const messages = messagesData.messages || [];

            unreadCountEl.textContent = messagesData.resultSizeEstimate || messages.length;

            if (messages.length > 0) {
                emailsListEl.innerHTML = '';
                // Fetch top 3 emails
                const top3 = messages.slice(0, 3);
                for (const msg of top3) {
                    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const msgData = await msgRes.json();

                    let subject = 'No Subject';
                    let from = 'Unknown';

                    if (msgData.payload && msgData.payload.headers) {
                        const subjHeader = msgData.payload.headers.find(h => h.name === 'Subject');
                        if (subjHeader) subject = subjHeader.value;

                        const fromHeader = msgData.payload.headers.find(h => h.name === 'From');
                        if (fromHeader) {
                            // Extract just the name, discard email address
                            from = fromHeader.value.split('<')[0].replace(/"/g, '').trim();
                        }
                    }

                    const a = document.createElement('a');
                    a.href = escapeHTML(`https://mail.google.com/mail/u/0/#inbox/${msg.id}`);
                    a.target = '_blank';
                    a.className = 'p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group flex flex-col gap-1';
                    a.innerHTML = `
                        <span class="font-bold text-slate-900 dark:text-slate-200 text-xs uppercase tracking-wide group-hover:text-primary transition-colors truncate">${escapeHTML(from)}</span>
                        <h5 class="text-slate-700 dark:text-slate-400 text-sm truncate">${escapeHTML(subject)}</h5>
                    `;
                    emailsListEl.appendChild(a);
                }
            }
        }
    } catch (err) {
        console.warn('Gmail integration requires setup and user authentication.', err);
        // Leave the default UI if it fails
    }
}

function initSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('close-settings-btn');
    const cancelBtn = document.getElementById('cancel-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');

    if (!modal || !settingsBtn) return;

    // Inputs
    const inputUsername = document.getElementById('setting-username');
    const inputDarkMode = document.getElementById('setting-dark-mode');

    const inputModQa = document.getElementById('setting-module-quick-access');
    const inputModTasks = document.getElementById('setting-module-tasks');
    const inputModHn = document.getElementById('setting-module-hn');
    const inputModGnews = document.getElementById('setting-module-gnews');
    const inputModGmail = document.getElementById('setting-module-gmail');

    const inputGnewsKey = document.getElementById('setting-gnews-key');

    const inputLat = document.getElementById('setting-weather-lat');
    const inputLon = document.getElementById('setting-weather-lon');
    const inputWeatherName = document.getElementById('setting-weather-name');

    const inputQaJson = document.getElementById('setting-quick-access-json');

    const openModal = () => {
        // Populate inputs with current settings
        inputUsername.value = currentSettings.username;
        inputDarkMode.checked = currentSettings.darkMode;

        inputModQa.checked = currentSettings.modules.quickAccess;
        inputModTasks.checked = currentSettings.modules.tasks;
        inputModHn.checked = currentSettings.modules.hn;
        inputModGnews.checked = currentSettings.modules.gnews;
        inputModGmail.checked = currentSettings.modules.gmail;

        inputGnewsKey.value = currentSettings.apiKeys.gnews || '';

        inputLat.value = currentSettings.weather.lat;
        inputLon.value = currentSettings.weather.lon;
        inputWeatherName.value = currentSettings.weather.name;

        inputQaJson.value = JSON.stringify(currentSettings.quickAccess, null, 2);

        modal.classList.remove('hidden');
    };

    const closeModal = () => {
        modal.classList.add('hidden');
    };

    const saveModal = async () => {
        try {
            // Parse QA JSON
            let parsedQa = currentSettings.quickAccess;
            try {
                parsedQa = JSON.parse(inputQaJson.value);
                if (!Array.isArray(parsedQa)) throw new Error('Quick Access must be an array');
            } catch (err) {
                alert('Invalid Quick Access JSON. Changes to Quick Access not saved. Error: ' + err.message);
                return; // Stop save if invalid JSON to prevent breaking UI
            }

            // Update settings object
            currentSettings.username = inputUsername.value;
            currentSettings.darkMode = inputDarkMode.checked;

            currentSettings.modules.quickAccess = inputModQa.checked;
            currentSettings.modules.tasks = inputModTasks.checked;
            currentSettings.modules.hn = inputModHn.checked;
            currentSettings.modules.gnews = inputModGnews.checked;
            currentSettings.modules.gmail = inputModGmail.checked;

            currentSettings.apiKeys.gnews = inputGnewsKey.value;

            currentSettings.weather.lat = inputLat.value;
            currentSettings.weather.lon = inputLon.value;
            currentSettings.weather.name = inputWeatherName.value;

            currentSettings.quickAccess = parsedQa;

            // Save to storage
            await browser.storage.local.set({ dashboardSettings: currentSettings });

            // Apply and re-init
            applySettingsToDOM();

            // Re-fetch APIs if modules enabled and configuration changed
            if (currentSettings.modules.weather !== false) initWeather();
            if (currentSettings.modules.hn) initHackerNews();
            if (currentSettings.modules.gnews) initGNews();
            // Not re-initing tasks/gmail here to avoid state/auth loop issues,
            // a page refresh is safer for full module tear-down but we do best-effort update.

            closeModal();
        } catch (e) {
            console.error('Error saving settings', e);
            alert('Failed to save settings.');
        }
    };

    settingsBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', saveModal);

    // Close when clicking outside modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}
