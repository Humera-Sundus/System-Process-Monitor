document.addEventListener('DOMContentLoaded', function() {
    // Initialize chart
    let idleTimeChart;
    
    function initChart() {
        const ctx = document.getElementById('idle-time-chart').getContext('2d');
        idleTimeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Idle Time (minutes)',
                    data: [],
                    backgroundColor: 'rgba(34, 197, 94, 0.5)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Minutes'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    }
                }
            }
        });
    }
    
    // Fetch idle time data
    async function fetchIdleTimeData() {
        try {
            const response = await fetch('/api/idle-time');
            if (!response.ok) {
                throw new Error('Failed to fetch idle time data');
            }
            
            const data = await response.json();
            if (data.length === 0) {
                document.getElementById('current-idle-time').innerText = '0m';
                document.getElementById('total-idle-today').innerText = '0h 0m';
                document.getElementById('avg-idle-period').innerText = '0m';
                document.getElementById('idle-count').innerText = '0';
                
                // No data message in the table
                document.getElementById('idle-periods').innerHTML = `
                    <tr>
                        <td colspan="3" class="py-3 text-center text-secondary">
                            No idle periods recorded yet
                        </td>
                    </tr>
                `;
                
                // Update chart with empty data
                updateChart([], []);
                return;
            }
            
            // Process the data
            const idlePeriods = data.map(item => {
                return {
                    timestamp: new Date(item.timestamp),
                    seconds: item.idle_seconds,
                    minutes: Math.floor(item.idle_seconds / 60)
                };
            });
            
            // Update the summary metrics
            updateSummaryMetrics(idlePeriods);
            
            // Update the chart
            const labels = idlePeriods.map(item => {
                return item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }).reverse(); // Most recent first
            
            const values = idlePeriods.map(item => item.minutes).reverse(); // Most recent first
            updateChart(labels, values);
            
            // Update the table
            updateIdlePeriodsTable(idlePeriods);
            
        } catch (error) {
            console.error('Error fetching idle time data:', error);
            
            // Show error message
            document.getElementById('current-idle-time').innerText = 'Error';
            document.getElementById('total-idle-today').innerText = 'Error';
            document.getElementById('avg-idle-period').innerText = 'Error';
            document.getElementById('idle-count').innerText = 'Error';
            
            document.getElementById('idle-periods').innerHTML = `
                <tr>
                    <td colspan="3" class="py-3 text-center text-danger">
                        <i class="fas fa-exclamation-circle me-2"></i> Failed to load idle time data
                    </td>
                </tr>
            `;
        }
    }
    
    // Update summary metrics
    function updateSummaryMetrics(idlePeriods) {
        // Most recent idle time
        const latestIdle = idlePeriods[0];
        const latestIdleMinutes = latestIdle ? Math.floor(latestIdle.seconds / 60) : 0;
        document.getElementById('current-idle-time').innerText = `${latestIdleMinutes}m`;
        
        // Today's idle periods
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayPeriods = idlePeriods.filter(item => item.timestamp >= today);
        
        // Total idle time today
        const totalSeconds = todayPeriods.reduce((total, item) => total + item.seconds, 0);
        const totalHours = Math.floor(totalSeconds / 3600);
        const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
        document.getElementById('total-idle-today').innerText = `${totalHours}h ${totalMinutes}m`;
        
        // Average idle period
        const avgSeconds = todayPeriods.length > 0 
            ? totalSeconds / todayPeriods.length 
            : 0;
        const avgMinutes = Math.floor(avgSeconds / 60);
        document.getElementById('avg-idle-period').innerText = `${avgMinutes}m`;
        
        // Number of idle periods today
        document.getElementById('idle-count').innerText = todayPeriods.length;
    }
    
    // Update the chart
    function updateChart(labels, values) {
        idleTimeChart.data.labels = labels;
        idleTimeChart.data.datasets[0].data = values;
        idleTimeChart.update();
    }
    
    // Update the idle periods table
    function updateIdlePeriodsTable(idlePeriods) {
        const tableBody = document.getElementById('idle-periods');
        tableBody.innerHTML = '';
        
        // Take the 10 most recent periods
        const recentPeriods = idlePeriods.slice(0, 10);
        
        recentPeriods.forEach(period => {
            const startTime = period.timestamp;
            const endTime = new Date(startTime.getTime() - period.seconds * 1000);
            
            const durationText = formatDuration(period.seconds);
            
            const row = `
                <tr>
                    <td class="py-3 px-4">${endTime.toLocaleString()}</td>
                    <td class="py-3 px-4">${durationText}</td>
                    <td class="py-3 px-4">${startTime.toLocaleString()}</td>
                </tr>
            `;
            
            tableBody.innerHTML += row;
        });
    }
    
    // Format duration nicely
    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${remainingSeconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${remainingSeconds}s`;
        }
    }
    
    // Initialize
    initChart();
    fetchIdleTimeData();
    
    // Refresh every 30 seconds
    setInterval(fetchIdleTimeData, 30000);
});