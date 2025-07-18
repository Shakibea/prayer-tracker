// --- Service Worker Update Flow ---
function handleServiceWorkerUpdates() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(registration => {
            // A new service worker has been found
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker == null) {
                    return;
                }
                installingWorker.onstatechange = () => {
                    // A new service worker has been installed and is waiting to activate
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('New content is available and will be used when all tabs for this page are closed.');
                        showUpdateBanner(registration);
                    }
                };
            };
        }).catch(error => {
            console.error('Error during service worker registration:', error);
        });

        let refreshing;
        // Detects when the new service worker has taken control and reloads the page
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    }
}

function showUpdateBanner(registration) {
    const updateBanner = document.getElementById('update-banner');
    const reloadButton = document.getElementById('reload-button');

    if (!updateBanner || !reloadButton) return;

    updateBanner.classList.remove('hidden');

    reloadButton.onclick = () => {
        // Send a message to the waiting service worker to skip waiting
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    };
}

// Initialize the service worker update handling
handleServiceWorkerUpdates();

// --- Original App Logic ---
document.addEventListener('DOMContentLoaded', function () {
    const grid = document.getElementById('prayer-grid');
    const monthHeader = document.getElementById('month-header');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const gotoTodayBtn = document.getElementById('goto-today-btn');
    const monthlyViewBtn = document.getElementById('monthly-view-btn');
    const annualViewBtn = document.getElementById('annual-view-btn');
    const annualGrid = document.getElementById('annual-grid');
    
    let displayedDate = new Date();
    let currentView = 'monthly'; // 'monthly' or 'annual'

    const prayers = ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];

    async function renderMonth(year, month) {
        // 1. Clear the grid and update header
        while (grid.firstChild) {
            grid.removeChild(grid.firstChild);
        }
        const date = new Date(year, month);
        monthHeader.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // 2. Get data for the new month
        const storageKey = `prayerTrackerData_${year}_${month}`;
        let prayerData = await localforage.getItem(storageKey) || {};

        function saveData() {
            localforage.setItem(storageKey, prayerData);
        }

        // 3. Render all days for the month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dateKey = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            if (!prayerData[dateKey]) {
                prayerData[dateKey] = Array(prayers.length).fill(false);
            }

            const dayCard = document.createElement('div');
            dayCard.className = 'bg-white rounded-2xl shadow-md p-5 flex flex-col';
            
            // Highlight today's card
            if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayCard.id = 'today-card';
                dayCard.classList.add('ring-2', 'ring-emerald-500', 'shadow-lg');
            }

            const dateString = currentDate.toLocaleDateString('en-US', { day: 'numeric' });
            const dayString = currentDate.toLocaleDateString('en-US', { weekday: 'long' });

            dayCard.innerHTML = `
                <div class="flex justify-between items-center mb-4 border-b pb-3">
                    <div class="text-2xl font-bold text-gray-800">${dateString}</div>
                    <div class="text-md font-semibold text-gray-500">${dayString}</div>
                </div>
                <div class="grid grid-cols-5 gap-x-2">
                    ${prayers.map((prayer, index) => `
                        <div class="flex flex-col items-center">
                            <div class="text-sm font-medium text-gray-600 mb-2">${prayer}</div>
                            <button 
                                data-day="${dateKey}" 
                                data-prayer-index="${index}" 
                                aria-label="Mark ${prayer} as prayed for ${dateKey}"
                                class="prayer-button w-12 h-12 rounded-full flex items-center justify-center bg-gray-200 text-white"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" class="check-icon h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                                </svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
            grid.appendChild(dayCard);
        }

        // 4. Add event listeners
        const prayerButtons = document.querySelectorAll('.prayer-button');
        prayerButtons.forEach(button => {
            const dateKey = button.dataset.day;
            const prayerIndex = parseInt(button.dataset.prayerIndex, 10);

            if (prayerData[dateKey] && prayerData[dateKey][prayerIndex]) {
                button.classList.add('checked');
            }

            button.addEventListener('click', () => {
                const isChecked = button.classList.toggle('checked');
                prayerData[dateKey][prayerIndex] = isChecked;
                saveData();
            });
        });
        
        saveData();
    }

    async function renderAnnualView(year) {
        annualGrid.innerHTML = '';
        monthHeader.textContent = `Annual Overview - ${year}`;

        const today = new Date();
        const monthPromises = [];
        const storageKeys = [];

        for (let month = 0; month < 12; month++) {
            const storageKey = `prayerTrackerData_${year}_${month}`;
            storageKeys.push(storageKey);
            monthPromises.push(localforage.getItem(storageKey));
        }

        const allPrayerData = await Promise.all(monthPromises);

        for (let month = 0; month < 12; month++) {
            const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long' });
            let prayerData = allPrayerData[month] || {};

            let totalPrayers = 0;
            let completedPrayers = 0;

            for (const dateKey in prayerData) {
                if (prayerData.hasOwnProperty(dateKey)) {
                    const dailyPrayers = prayerData[dateKey];
                    totalPrayers += dailyPrayers.length;
                    completedPrayers += dailyPrayers.filter(p => p).length;
                }
            }

            const completionPercentage = totalPrayers > 0 ? Math.round((completedPrayers / totalPrayers) * 100) : 0;

            const monthCard = document.createElement('div');
            monthCard.className = 'bg-white rounded-2xl shadow-md p-5 flex flex-col items-center justify-center cursor-pointer hover:shadow-lg transition-shadow';
            monthCard.innerHTML = `
                <div class="text-2xl font-bold text-gray-800 mb-2">${monthName}</div>
                <div class="text-lg text-gray-600">${completionPercentage}% Completed</div>
                <div class="w-full bg-gray-200 rounded-full h-2.5 mt-3">
                    <div class="bg-emerald-500 h-2.5 rounded-full" style="width: ${completionPercentage}%"></div>
                </div>
            `;
            monthCard.addEventListener('click', () => {
                displayedDate = new Date(year, month);
                switchView('monthly');
            });
            annualGrid.appendChild(monthCard);
        }
    }

    async function switchView(view) {
        currentView = view;
        if (currentView === 'monthly') {
            grid.classList.remove('hidden');
            annualGrid.classList.add('hidden');
            monthlyViewBtn.classList.add('btn-active');
            monthlyViewBtn.classList.remove('btn-inactive');
            annualViewBtn.classList.remove('btn-active');
            annualViewBtn.classList.add('btn-inactive');
            await renderMonth(displayedDate.getFullYear(), displayedDate.getMonth());
        } else {
            grid.classList.add('hidden');
            annualGrid.classList.remove('hidden');
            annualViewBtn.classList.add('btn-active');
            annualViewBtn.classList.remove('btn-inactive');
            monthlyViewBtn.classList.remove('btn-active');
            monthlyViewBtn.classList.add('btn-inactive');
            await renderAnnualView(displayedDate.getFullYear());
        }
    }

    function navigate(offset) {
        if (currentView === 'monthly') {
            displayedDate.setMonth(displayedDate.getMonth() + offset);
            renderMonth(displayedDate.getFullYear(), displayedDate.getMonth());
        } else { // annual view
            displayedDate.setFullYear(displayedDate.getFullYear() + offset);
            renderAnnualView(displayedDate.getFullYear());
        }
    }

    function scrollToToday() {
        const todayCard = document.getElementById('today-card');
        if (todayCard) {
            todayCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // --- Event Listeners ---
    prevMonthBtn.addEventListener('click', () => navigate(-1));
    nextMonthBtn.addEventListener('click', () => navigate(1));
    
    monthlyViewBtn.addEventListener('click', () => switchView('monthly'));
    annualViewBtn.addEventListener('click', () => switchView('annual'));

    gotoTodayBtn.addEventListener('click', () => {
        const today = new Date();
        // If we are already in the correct month and view, just scroll.
        if (currentView === 'monthly' && displayedDate.getFullYear() === today.getFullYear() && displayedDate.getMonth() === today.getMonth()) {
            scrollToToday();
        } else {
            // Otherwise, switch view and render the correct month.
            displayedDate = today;
            switchView('monthly').then(() => {
                setTimeout(scrollToToday, 50);
            });
        }
    });

    // --- Initial Load ---
    switchView('monthly').then(() => {
        setTimeout(scrollToToday, 100);
    });
});
