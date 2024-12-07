// Connect to WebSocket server
const socket = io();

// Current market and analysis state
let currentMarket = document.getElementById('market-select').value;
let lastAnalysis = null;
let updateInterval;
let digitDistributionChart = null;

// DOM Elements
const marketSelect = document.getElementById('market-select');
const chosenDigitInput = document.getElementById('chosen-digit');
const currentMarketSpan = document.getElementById('current-market');
const currentPriceSpan = document.getElementById('current-price');
const lastDigitSpan = document.getElementById('last-digit');
const lastUpdateSpan = document.getElementById('last-update');
const totalSamplesSpan = document.getElementById('total-samples');
const digitsDisplay = document.getElementById('digits-display');
const predictionDiv = document.getElementById('prediction');

// Initialize event listeners
marketSelect.addEventListener('change', function() {
    currentMarket = this.value;
    updateMarketName();
    // Reset the update interval
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    startUpdates();
});

chosenDigitInput.addEventListener('input', function() {
    const chosenDigit = parseInt(this.value);
    if (lastAnalysis) {
        updateProbabilityDisplay(lastAnalysis);
    }
});

// Update market name in the display
function updateMarketName() {
    const selectedOption = marketSelect.options[marketSelect.selectedIndex];
    currentMarketSpan.textContent = selectedOption.text;
}

// Format price with appropriate decimal places
function formatPrice(price) {
    return parseFloat(price).toFixed(4);
}

// Update the digits display grid
function updateDigitsDisplay(digits) {
    digitsDisplay.innerHTML = '';
    
    // Create digits in reverse order (most recent first)
    [...digits].reverse().forEach((digit, index) => {
        const digitElement = document.createElement('div');
        digitElement.className = 'digit';
        digitElement.textContent = digit;
        
        // Add color class based on comparison with chosen digit
        const chosenDigit = parseInt(chosenDigitInput.value);
        if (!isNaN(chosenDigit)) {
            if (digit > chosenDigit) {
                digitElement.classList.add('higher');
            } else if (digit < chosenDigit) {
                digitElement.classList.add('lower');
            } else {
                digitElement.classList.add('equal');
            }
        }
        
        // Add animation for new digits
        if (index === 0) {
            digitElement.style.animation = 'popIn 0.3s ease-out';
        }
        
        digitsDisplay.appendChild(digitElement);
    });
}

// Get color for digit based on comparison with chosen digit
function getDigitColor(digit, target) {
    if (digit > target) return '#28a745';  // Green for higher
    if (digit < target) return '#dc3545';  // Red for lower
    return '#ffc107';  // Yellow for equal
}

// Update probability display
function updateProbabilityDisplay(analysis) {
    const chosenDigit = parseInt(chosenDigitInput.value);
    const targetAnalysis = analysis[chosenDigit];
    if (!targetAnalysis) return;

    // Update probability bars
    document.getElementById('higher-prob').style.width = `${targetAnalysis.higher_prob}%`;
    document.getElementById('higher-prob').textContent = `${targetAnalysis.higher_prob.toFixed(1)}%`;
    
    document.getElementById('lower-prob').style.width = `${targetAnalysis.lower_prob}%`;
    document.getElementById('lower-prob').textContent = `${targetAnalysis.lower_prob.toFixed(1)}%`;
    
    document.getElementById('equal-prob').style.width = `${targetAnalysis.equal_prob}%`;
    document.getElementById('equal-prob').textContent = `${targetAnalysis.equal_prob.toFixed(1)}%`;

    // Update prediction
    let prediction = '';
    if (targetAnalysis.higher_prob > 60) {
        prediction = `<strong>Prediction:</strong> Next digit likely to be HIGHER than ${chosenDigit} (${targetAnalysis.higher_prob.toFixed(1)}% probability)`;
        predictionDiv.className = 'alert alert-success';
    } else if (targetAnalysis.lower_prob > 60) {
        prediction = `<strong>Prediction:</strong> Next digit likely to be LOWER than ${chosenDigit} (${targetAnalysis.lower_prob.toFixed(1)}% probability)`;
        predictionDiv.className = 'alert alert-danger';
    } else {
        prediction = `<strong>No clear trend.</strong> Insufficient probability for prediction (need >60%)`;
        predictionDiv.className = 'alert alert-warning';
    }
    predictionDiv.innerHTML = prediction;
}

// Initialize digit distribution chart
function initializeDigitDistributionChart() {
    const ctx = document.getElementById('digitDistributionChart').getContext('2d');
    digitDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
            datasets: [{
                label: 'Digit Distribution (%)',
                data: Array(10).fill(0),
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Percentage (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Digit'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Digit Distribution (Last 20 Ticks)'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toFixed(1) + '%';
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: function(value) {
                        return value + '%';
                    },
                    font: {
                        weight: 'bold'
                    },
                    color: 'rgba(0, 0, 0, 0.8)'
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Calculate digit distribution
function calculateDigitDistribution(digits) {
    const distribution = Array(10).fill(0);
    const total = digits.length;
    
    digits.forEach(digit => {
        distribution[digit]++;
    });
    
    // Convert to percentages
    return distribution.map(count => (count / total * 100).toFixed(1));
}

// Update digit distribution chart
function updateDigitDistributionChart(digits) {
    if (!digitDistributionChart) {
        initializeDigitDistributionChart();
    }
    
    const distribution = calculateDigitDistribution(digits);
    digitDistributionChart.data.datasets[0].data = distribution;
    digitDistributionChart.update();
}

// Handle incoming market updates
socket.on('market_update', function(data) {
    if (data.symbol !== currentMarket) return;
    
    // Update display elements
    currentPriceSpan.textContent = formatPrice(data.price);
    lastDigitSpan.textContent = data.last_digit;
    lastUpdateSpan.textContent = new Date().toLocaleTimeString();
    totalSamplesSpan.textContent = data.digit_history.length;
    
    // Update digits display
    updateDigitsDisplay(data.digit_history);
    
    // Update digit distribution chart
    updateDigitDistributionChart(data.digit_history);
    
    // Update analysis if available
    if (data.analysis) {
        lastAnalysis = data.analysis;
        updateProbabilityDisplay(data.analysis);
    }
});

// Update digits display and analyze automatically
function startUpdates() {
    // Update every second
    updateInterval = setInterval(() => {
        fetch(`/api/digits/${currentMarket}`)
            .then(response => response.json())
            .then(data => {
                const digitsContainer = document.getElementById('digits-display');
                digitsContainer.innerHTML = '';
                
                // Create table for digits and prices
                const table = document.createElement('table');
                table.className = 'digits-table';
                
                // Add header
                const header = table.createTHead();
                const headerRow = header.insertRow();
                ['Digit', 'Price', 'Time', 'Prediction'].forEach(text => {
                    const th = document.createElement('th');
                    th.textContent = text;
                    headerRow.appendChild(th);
                });
                
                // Add data rows
                const tbody = table.createTBody();
                for(let i = 0; i < data.digits.length; i++) {
                    const row = tbody.insertRow();
                    
                    // Digit cell with colored background
                    const digitCell = row.insertCell();
                    digitCell.className = 'digit';
                    digitCell.textContent = data.digits[i];
                    
                    // Price cell
                    const priceCell = row.insertCell();
                    priceCell.textContent = formatPrice(data.prices[i]);
                    
                    // Time cell
                    const timeCell = row.insertCell();
                    const date = new Date(data.timestamps[i] * 1000);
                    timeCell.textContent = date.toLocaleTimeString();
                    
                    // Prediction cell (for the last row only)
                    const predictionCell = row.insertCell();
                    if (i === data.digits.length - 1 && lastAnalysis) {
                        const chosenDigit = lastAnalysis.chosen_digit;
                        const digit = data.digits[i];
                        if (digit > chosenDigit) {
                            predictionCell.innerHTML = '<span class="prediction higher">HIGHER</span>';
                        } else if (digit < chosenDigit) {
                            predictionCell.innerHTML = '<span class="prediction lower">LOWER</span>';
                        } else {
                            predictionCell.innerHTML = '<span class="prediction equal">EQUAL</span>';
                        }
                    }
                }
                
                digitsContainer.appendChild(table);
                
                // Update statistics
                const now = new Date();
                document.getElementById('last-update').textContent = now.toLocaleTimeString();
                document.getElementById('total-samples').textContent = data.count;
            })
            .catch(error => console.error('Error fetching digits:', error));
        
        // If there's a chosen digit, start analyzing
        const chosenDigit = document.getElementById('chosen-digit').value;
        if (chosenDigit !== '') {
            analyzeDigit();
        }
    }, 1000);
}

// Analyze probability for chosen digit
function analyzeDigit() {
    const chosenDigit = document.getElementById('chosen-digit').value;
    
    if (chosenDigit === '' || chosenDigit < 0 || chosenDigit > 9) {
        alert('Please enter a valid digit between 0 and 9');
        return;
    }
    
    fetch(`/api/analyze/${currentMarket}/${chosenDigit}`)
        .then(response => response.json())
        .then(data => {
            lastAnalysis = data;
            
            if (data.error === 'No data available yet') {
                updateProbabilityDisplay(data);
                return;
            }
            
            updateProbabilityDisplay(data);
            
            // Update trend information
            const trendElement = document.getElementById('trend-info');
            if (trendElement) {
                let trendClass = '';
                let trendText = '';
                switch(data.trend) {
                    case 'UP':
                        trendClass = 'trend-up';
                        trendText = '↑ Trending Up';
                        break;
                    case 'DOWN':
                        trendClass = 'trend-down';
                        trendText = '↓ Trending Down';
                        break;
                    default:
                        trendClass = 'trend-stable';
                        trendText = '→ Stable';
                }
                trendElement.className = `trend ${trendClass}`;
                trendElement.textContent = trendText;
            }
        })
        .catch(error => console.error('Error analyzing digit:', error));
}

// Add event listener for Enter key on input
document.getElementById('chosen-digit').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        analyzeDigit();
    }
});

// Initialize display
updateMarketName();

// Start updates
startUpdates();
