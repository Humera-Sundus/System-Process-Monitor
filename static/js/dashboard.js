document.addEventListener('DOMContentLoaded', function() {
    function updateProgress(circleId, textId, percentage) {
        const circle = document.getElementById(circleId);
        const text = document.getElementById(textId);
    
        const totalLength = circle.getTotalLength();
        const offset = totalLength * (1 - percentage / 100);
    
        circle.style.strokeDasharray = totalLength;
        circle.style.strokeDashoffset = offset;
    
        text.innerText = percentage.toFixed(1) + '%';
    }
    
    async function fetchSystemStats() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/system-stats');
        if (!response.ok) {
            throw new Error('Failed to fetch system stats');
        }
        const data = await response.json();
        console.log("✅ System Stats Response:", data); // Debugging
        if (typeof data.cpu_usage !== 'number' || typeof data.memory_usage !== 'number') {
            throw new Error("Invalid data format received");
        }
        
        updateProgress('cpu-progress-circle', 'cpu-percentage-text', data.cpu_usage);
        updateProgress('memory-progress-circle', 'memory-percentage-text', data.memory_usage);
        

    } catch (error) {
        console.error('❌ Error fetching system stats:', error);
        document.getElementById('cpu-percentage-text').innerText = 'Error';
        document.getElementById('memory-percentage-text').innerText = 'Error';
    }
}
async function fetchIdleTime() {
    try {
        const response = await fetch('/api/idle-dashboard'); // adjust endpoint name if different
        if (!response.ok) throw new Error('Failed to fetch idle time');

        const data = await response.json();
        console.log("✅ Idle Time Response:", data); // Debug output

        // Assuming you have this ID in your HTML
        document.getElementById('idle-time-text').innerText = `${data.latest_idle_min}m`;
    } catch (error) {
        console.error('❌ Error fetching idle time:', error);
        document.getElementById('idle-time-text').innerText = 'N/A';
    }
}

// Auto-refresh system stats every 10 seconds
setInterval(fetchSystemStats, 10000);

// Call on page load
fetchSystemStats();

setInterval(fetchIdleTime, 10000);
fetchIdleTime();

    window.restartProcess = function(processName) {
        if (!processName) {
            showNotification('Error: Process name is required', 'error');
            return;
        }

        fetch('/api/restart-process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ process_name: processName })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification(data.message, 'success');
            } else {
                showNotification(data.message || 'Failed to restart process', 'error');
            }
            setTimeout(fetchActiveProcesses, 1000);
        })
        .catch(error => {
            console.error('Error restarting process:', error);
            showNotification(`Error restarting process: ${error.message}`, 'error');
        });
    };

    window.killProcess = function(processName) {
        if (!processName) {
            showNotification('Error: Process name is required', 'error');
            return;
        }

        fetch('/api/kill-process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ process_name: processName })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification(data.message, 'success');
            } else {
                showNotification(data.message || 'Failed to kill process', 'error');
            }
            setTimeout(fetchActiveProcesses, 1000);
        })
        .catch(error => {
            console.error('Error killing process:', error);
            showNotification(`Error killing process: ${error.message}`, 'error');
        });
    };

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded shadow-md transition-opacity ${
            type === 'success' ? 'bg-green-100 border-l-4 border-green-500 text-green-700' :
            'bg-red-100 border-l-4 border-red-500 text-red-700'
        }`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle mr-2"></i>
            ${message}
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }

async function fetchActiveProcesses() {
    const container = document.getElementById('active-applications');
    const loading = document.getElementById('loading-indicator');
    const error = document.getElementById('error-message');

    try {
        container.innerHTML = '';
        loading.classList.remove('hidden');
        error.classList.add('hidden');

        const response = await fetch('/api/list-processes');
        if (!response.ok) {
            throw new Error('Failed to fetch active processes');
        }

        const data = await response.json();
        console.log("✅ Active Processes Response:", data); // Debugging log

        if (!data || !Array.isArray(data)) {
            throw new Error("Invalid response format from API");
        }

        loading.classList.add('hidden');

        if (data.length === 0) {
            container.innerHTML = '<div class="text-center py-6 text-gray-500"><p>No active processes found</p></div>';
            return;
        }

        updateProcessList(data); // Make sure data is being passed correctly
    } catch (error) {
        console.error('❌ Error fetching processes:', error);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        error.textContent = `Error: ${error.message}`;
    }
}

    function updateProcessList(processes) {
        const container = document.getElementById('active-applications');
        container.innerHTML = '';

        processes.forEach(proc => {
            const procHTML = `
                <div class="bg-gray-50 p-4 rounded-lg flex items-center justify-between shadow hover:bg-gray-100 transition-colors">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-window-maximize text-indigo-600"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg">${proc.name}</h4>
                            <p class="text-sm text-gray-600">PID: ${proc.pid}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-8">
                        <div class="text-center">
                            <p class="text-sm text-gray-600">CPU</p>
                            <p class="font-bold">${parseFloat(proc.cpu_percent || 0).toFixed(1)}%</p>
                        </div>
                        <div class="text-center">
                            <p class="text-sm text-gray-600">Memory</p>
                            <p class="font-bold">${parseFloat(proc.memory_percent || 0).toFixed(1)}%</p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="restartProcess('${proc.name}')"
                                    class="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors"
                                    title="Restart Process">
                                <i class="fas fa-redo-alt"></i>
                            </button>
                            <button onclick="killProcess('${proc.name}')"
                                    class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition-colors"
                                    title="Kill Process">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += procHTML;
        });
    }

    // Initialize
    fetchActiveProcesses();

    // Manual refresh button
    document.getElementById('refresh-processes')?.addEventListener('click', () => {
        fetchActiveProcesses();
        fetchSystemStats();
        fetchIdleTime();
    });
   

    // Auto-refresh interval
    setInterval(fetchActiveProcesses, 10000);
});

   

   