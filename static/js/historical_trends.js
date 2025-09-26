document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts and variables
    let cpuChart, memoryChart;
    let currentTimeRange = 'day';
    
    // Show/hide loading indicators
    function setLoading(id, isLoading) {
        const element = document.getElementById(id);
        if (element) {
            if (isLoading) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        }
    }
    
    // Generic error handling
    function showError(message) {
        console.error(message);
        const errorElement = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        
        if (errorElement && errorText) {
            errorText.textContent = message;
            errorElement.classList.remove('hidden');
            
            // Hide the error after 5 seconds
            setTimeout(() => {
                errorElement.classList.add('hidden');
            }, 5000);
        }
    }
    
    // Generate sample data for charts
    function generateSampleData(timeRange) {
        const now = new Date();
        const data = [];
        let points = 24;
        let interval = 60; // minutes
        
        if (timeRange === 'week') {
            points = 7 * 24;
            interval = 60;
        } else if (timeRange === 'month') {
            points = 30;
            interval = 24 * 60;
        }
        
        for (let i = 0; i < points; i++) {
            const timestamp = new Date(now - (i * interval * 60 * 1000));
            data.unshift({
                timestamp: timestamp.toISOString(),
                cpu_percent: Math.min(5 + Math.random() * 20 + Math.sin(i/5) * 10, 100),
                memory_percent: Math.min(20 + Math.random() * 30 + Math.cos(i/7) * 10, 100)
            });
        }
        
        return data;
    }
    
    // Initialize the charts
    function initializeCharts() {
        // Common chart options
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 6
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 10,
                    cornerRadius: 4
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            animation: {
                duration: 750
            }
        };
        
        // CPU Chart
        const cpuCtx = document.getElementById('cpu-chart').getContext('2d');
        cpuChart = new Chart(cpuCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'CPU Usage (%)',
                    data: [],
                    borderColor: 'rgb(79, 70, 229)',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: 'rgb(79, 70, 229)'
                }]
            },
            options: chartOptions
        });
        
        // Memory Chart
        const memoryCtx = document.getElementById('memory-chart').getContext('2d');
        memoryChart = new Chart(memoryCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Memory Usage (%)',
                    data: [],
                    borderColor: 'rgb(147, 51, 234)',
                    backgroundColor: 'rgba(147, 51, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: 'rgb(147, 51, 234)'
                }]
            },
            options: chartOptions
        });
    }
    
    // Format date string for display
    function formatDateLabel(dateString, timeRange) {
        try {
            const date = new Date(dateString);
            
            if (isNaN(date.getTime())) {
                console.error('Invalid date:', dateString);
                return 'Invalid Date';
            }
            
            if (timeRange === 'day') {
                // For 24 hours: HH:MM
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (timeRange === 'week') {
                // For week: Day HH:MM
                return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + 
                       date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                // For month: MM/DD
                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Date Error';
        }
    }
    
    // Fetch historical system stats and update charts
    async function fetchHistoricalStats(timeRange) {
        setLoading('cpu-loading', true);
        setLoading('memory-loading', true);
        
        try {
            const response = await fetch(`/api/historical-system-stats?range=${timeRange}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch historical stats: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (!Array.isArray(data) || data.length === 0) {
                console.warn('No historical data available');
                // Don't throw here - we'll handle the empty array case
            }
            
            // Format data for charts
            const timeLabels = data.map(entry => formatDateLabel(entry.timestamp, timeRange));
            const cpuValues = data.map(entry => parseFloat(entry.cpu_percent));
            const memoryValues = data.map(entry => parseFloat(entry.memory_percent));
            
            // Update charts
            updateCharts(timeLabels, cpuValues, memoryValues);
        } catch (error) {
            showError(`Failed to load historical data: ${error.message}`);
            updateCharts([], [], []);
        } finally {
            setLoading('cpu-loading', false);
            setLoading('memory-loading', false);
        }
    }
    
    // Update charts with new data
    function updateCharts(labels, cpuData, memoryData) {
        // Update CPU chart
        cpuChart.data.labels = labels;
        cpuChart.data.datasets[0].data = cpuData;
        cpuChart.update();
        
        // Update Memory chart
        memoryChart.data.labels = labels;
        memoryChart.data.datasets[0].data = memoryData;
        memoryChart.update();
    }
    
    // Fetch all processes
async function fetchProcesses() {
    try {
        const response = await fetch('/api/processes');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch processes: ${response.status} ${response.statusText}`);
        }
        
        const processes = await response.json();
        
        if (!Array.isArray(processes)) {
            throw new Error('Invalid process data format');
        }
        
        return processes;
    } catch (error) {
        console.error('Error fetching processes:', error);
        showError(`Failed to load process data: ${error.message}`);
        return [];
    }
}

// Fetch resource-intensive processes and update table
async function fetchResourceIntensiveProcesses() {
    const tableBody = document.getElementById('top-processes');
    
    try {
        // First try to fetch from resource-intensive endpoint
        let processes = [];
        try {
            const response = await fetch('/api/resource-intensive-processes');
            
            if (!response.ok) {
                throw new Error(`Failed to fetch resource-intensive processes: ${response.status} ${response.statusText}`);
            }
            
            processes = await response.json();
        } catch (error) {
            console.warn('Failed to fetch from resource-intensive endpoint, trying /api/processes:', error);
            // Fall back to general processes endpoint
            processes = await fetchProcesses();
            
            // Sort by CPU usage to get the most resource-intensive ones
            processes.sort((a, b) => {
                return parseFloat(b.cpu_percent || 0) - parseFloat(a.cpu_percent || 0);
            });
            
            // Take the top 10
            processes = processes.slice(0, 10);
            
            // Add peak values
            processes.forEach(proc => {
                if (!proc.peak_cpu_percent) {
                    proc.peak_cpu_percent = proc.cpu_percent;
                }
                if (!proc.peak_memory_percent) {
                    proc.peak_memory_percent = proc.memory_percent;
                }
            });
        }
        
        if (!Array.isArray(processes)) {
            throw new Error('Invalid process data format');
        }
        
        // Clear table
        tableBody.innerHTML = '';
        
        if (processes.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-10 text-center text-gray-500">
                        No resource-intensive processes found
                    </td>
                </tr>
            `;
            return;
        }
        
        // Fill table with process data
        processes.forEach(proc => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="py-3 px-4 border-b">${proc.process_name}</td>
                <td class="py-3 px-4 border-b">${proc.cpu_usage ? parseFloat(proc.cpu_usage).toFixed(1) : '0.0'}%</td>
                <td class="py-3 px-4 border-b">${proc.memory_usage ? parseFloat(proc.memory_usage).toFixed(1) : '0.0'}%</td>
                <td class="py-3 px-4 border-b">${proc.peak_cpu_usage ? parseFloat(proc.peak_cpu_usage).toFixed(1) : '0.0'}%</td>
                <td class="py-3 px-4 border-b">${proc.peak_memory_usage ? parseFloat(proc.peak_memory_usage).toFixed(1) : '0.0'}%</td>
            `;
            tableBody.appendChild(row);
        });
        
    } catch (error) {
        showError(`Failed to load process data: ${error.message}`);
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="py-10 text-center text-red-500">
                    <i class="fas fa-exclamation-circle mr-2"></i>
                    Error loading process data: ${error.message}
                </td>
            </tr>
        `;
    }
}

    
    // Set up time range buttons
    function setupTimeRangeButtons() {
        document.querySelectorAll('.time-range-btn').forEach(button => {
            button.addEventListener('click', function() {
                // Update button states
                document.querySelectorAll('.time-range-btn').forEach(btn => {
                    btn.classList.remove('bg-indigo-600', 'text-white');
                    btn.classList.add('bg-gray-200', 'text-gray-800');
                });
                
                this.classList.remove('bg-gray-200', 'text-gray-800');
                this.classList.add('bg-indigo-600', 'text-white');
                
                // Get new time range and fetch data
                const newRange = this.getAttribute('data-range');
                currentTimeRange = newRange;
                fetchHistoricalStats(newRange);
            });
        });
    }
    
    // Initialize the page
    function initialize() {
        initializeCharts();
        setupTimeRangeButtons();
        
        // Load initial data
        fetchHistoricalStats(currentTimeRange);
        fetchResourceIntensiveProcesses();
        
        // Refresh data every 30 seconds
        setInterval(() => {
            fetchHistoricalStats(currentTimeRange);
            fetchResourceIntensiveProcesses();
        }, 30000);
    }
    
    // Start the application
    initialize();
});