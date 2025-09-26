document.addEventListener('DOMContentLoaded', function() {
    console.log("Settings JS loaded");
    
    // Theme toggle setup
    const themeSelect = document.getElementById('theme-selection');
    if (themeSelect) {
        const savedTheme = localStorage.getItem('theme') || 'light';
        themeSelect.value = savedTheme;
        
        themeSelect.addEventListener('change', () => {
            const newTheme = themeSelect.value;
            localStorage.setItem('theme', newTheme);
            if (newTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        });
    }

    // CPU threshold display
    const cpuThreshold = document.getElementById('cpu-threshold');
    const cpuThresholdValue = document.getElementById('cpu-threshold-value');
    if (cpuThreshold && cpuThresholdValue) {
        // Set initial value
        cpuThresholdValue.textContent = cpuThreshold.value + '%';
        
        // Update when slider changes
        cpuThreshold.addEventListener('input', function() {
            cpuThresholdValue.textContent = this.value + '%';
        });
    }
    
    // Memory threshold display
    const memoryThreshold = document.getElementById('memory-threshold');
    const memoryThresholdValue = document.getElementById('memory-threshold-value');
    if (memoryThreshold && memoryThresholdValue) {
        // Set initial value
        memoryThresholdValue.textContent = memoryThreshold.value + '%';
        
        // Update when slider changes
        memoryThreshold.addEventListener('input', function() {
            memoryThresholdValue.textContent = this.value + '%';
        });
    }
    
    // Load saved settings
    function loadSavedSettings() {
        // General settings
        const refreshInterval = document.getElementById('refresh-interval');
        if (refreshInterval && localStorage.getItem('refreshInterval')) {
            refreshInterval.value = localStorage.getItem('refreshInterval');
        }
        
        const startWithSystem = document.getElementById('start-with-system');
        if (startWithSystem && localStorage.getItem('startWithSystem') === 'false') {
            startWithSystem.checked = false;
        }
        
        const enableNotifications = document.getElementById('enable-notifications');
        if (enableNotifications && localStorage.getItem('enableNotifications') === 'false') {
            enableNotifications.checked = false;
        }
        
        // Process settings
        if (cpuThreshold && cpuThresholdValue && localStorage.getItem('cpuThreshold')) {
            const savedValue = localStorage.getItem('cpuThreshold');
            cpuThreshold.value = savedValue;
            cpuThresholdValue.textContent = savedValue + '%';
        }
        
        if (memoryThreshold && memoryThresholdValue && localStorage.getItem('memoryThreshold')) {
            const savedValue = localStorage.getItem('memoryThreshold');
            memoryThreshold.value = savedValue;
            memoryThresholdValue.textContent = savedValue + '%';
        }
        
        const processBlacklist = document.getElementById('process-blacklist');
        if (processBlacklist && localStorage.getItem('processBlacklist')) {
            processBlacklist.value = localStorage.getItem('processBlacklist');
        }
        
        // Data settings
        const dataRetention = document.getElementById('data-retention');
        if (dataRetention && localStorage.getItem('dataRetention')) {
            dataRetention.value = localStorage.getItem('dataRetention');
        }
    }

    // Save general settings
    const saveGeneralBtn = document.getElementById('save-general-settings');
    if (saveGeneralBtn) {
        saveGeneralBtn.addEventListener('click', function() {
            const refreshInterval = document.getElementById('refresh-interval');
            const startWithSystem = document.getElementById('start-with-system');
            const enableNotifications = document.getElementById('enable-notifications');
            const themeSelect = document.getElementById('theme-selection');
            
            // Save to localStorage
            if (refreshInterval) localStorage.setItem('refreshInterval', refreshInterval.value);
            if (startWithSystem) localStorage.setItem('startWithSystem', startWithSystem.checked);
            if (enableNotifications) localStorage.setItem('enableNotifications', enableNotifications.checked);
            if (themeSelect) localStorage.setItem('theme', themeSelect.value);
            
            // Send to server
            fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refresh_interval: refreshInterval ? parseInt(refreshInterval.value) : null,
                    theme: themeSelect ? themeSelect.value : null,
                    email_notify: enableNotifications ? enableNotifications.checked : null
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log("Settings saved:", data);
                showNotification('General settings saved successfully!');
            })
            .catch(error => {
                console.error("Error saving settings:", error);
                showNotification('Error saving settings', 'error');
            });
        });
    }
    
    // Save process settings
    const saveProcessBtn = document.getElementById('save-process-settings');
    if (saveProcessBtn) {
        saveProcessBtn.addEventListener('click', function() {
            const cpuThreshold = document.getElementById('cpu-threshold');
            const memoryThreshold = document.getElementById('memory-threshold');
            const processBlacklist = document.getElementById('process-blacklist');
            
            // Save to localStorage
            if (cpuThreshold) localStorage.setItem('cpuThreshold', cpuThreshold.value);
            if (memoryThreshold) localStorage.setItem('memoryThreshold', memoryThreshold.value);
            if (processBlacklist) localStorage.setItem('processBlacklist', processBlacklist.value);
            
            // Send to server
            fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cpu_threshold: cpuThreshold ? parseInt(cpuThreshold.value) : null,
                    memory_threshold: memoryThreshold ? parseInt(memoryThreshold.value) : null,
                    process_blacklist: processBlacklist ? processBlacklist.value.split('\n') : null
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log("Process settings saved:", data);
                showNotification('Process settings saved successfully!');
            })
            .catch(error => {
                console.error("Error saving process settings:", error);
                showNotification('Error saving settings', 'error');
            });
        });
    }
    
    // Save data settings
    const saveDataBtn = document.getElementById('save-data-settings');
    if (saveDataBtn) {
        saveDataBtn.addEventListener('click', function() {
            const dataRetention = document.getElementById('data-retention');
            
            // Save to localStorage
            if (dataRetention) localStorage.setItem('dataRetention', dataRetention.value);
            
            // Send to server
            fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    auto_cleanup_days: dataRetention ? parseInt(dataRetention.value) : null
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log("Data settings saved:", data);
                showNotification('Data settings saved successfully!');
            })
            .catch(error => {
                console.error("Error saving data settings:", error);
                showNotification('Error saving settings', 'error');
            });
        });
    }
    
    // Export data button
    const exportDataBtn = document.getElementById('export-data');
    if (exportDataBtn) {
            exportDataBtn.addEventListener('click', function() {
            const exportData = {
                timestamp: new Date().toISOString(),
                settings: {
                    theme: localStorage.getItem('theme'),
                    refreshInterval: localStorage.getItem('refreshInterval'),
                    startWithSystem: localStorage.getItem('startWithSystem'),
                    enableNotifications: localStorage.getItem('enableNotifications'),
                    cpuThreshold: localStorage.getItem('cpuThreshold'),
                    memoryThreshold: localStorage.getItem('memoryThreshold'),
                    processBlacklist: localStorage.getItem('processBlacklist'),
                    dataRetention: localStorage.getItem('dataRetention')
            },
            
                exportDate: new Date().toISOString()
        };

        fetch('/export-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(exportData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Data exported to: ' + data.filePath);
            } else {
                showNotification('Export failed.');
            }
        })
        .catch(error => {
            console.error('Export error:', error);
            showNotification('Export error occurred.');
        });
    });
}

    // Clear data modal handling
    const clearDataBtn = document.getElementById('clear-data');
    const clearDataModal = document.getElementById('clearDataModal');
    const cancelClearDataBtn = document.getElementById('cancel-clear-data');
    const confirmClearDataBtn = document.getElementById('confirm-clear-data');
    
    if (clearDataBtn && clearDataModal) {
        clearDataBtn.addEventListener('click', function() {
            clearDataModal.classList.remove('hidden');
        });
    }
    
    if (cancelClearDataBtn && clearDataModal) {
        cancelClearDataBtn.addEventListener('click', function() {
            clearDataModal.classList.add('hidden');
        });
    }
    
    if (confirmClearDataBtn && clearDataModal) {
        confirmClearDataBtn.addEventListener('click', function() {
            fetch('/clear-all-data', {
                method: 'POST'
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showNotification('All monitoring data deleted.');
                    // Optionally close the modal
                } else {
                    showNotification('Failed to delete data: ' + data.message);
                }
            })
            .catch(err => {
                console.error(err);
                showNotification('An error occurred.');
            });
        });
           
    }
    
    // Show notification
    function showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const notificationMessage = document.getElementById('notification-message');
        
        if (notification && notificationMessage) {
            notification.classList.remove('hidden');
            notification.classList.remove('bg-green-500', 'bg-red-500');
            notification.classList.add(type === 'success' ? 'bg-green-500' : 'bg-red-500');
            
            notificationMessage.textContent = message;
            
            setTimeout(() => {
                notification.classList.add('hidden');
            }, 3000);
        }
    }
    
    // Load saved settings on page load
    loadSavedSettings();
});