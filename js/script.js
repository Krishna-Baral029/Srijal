document.addEventListener('DOMContentLoaded', function() {
    // Redirect to home page on refresh
    if (window.performance && window.performance.navigation.type === window.performance.navigation.TYPE_RELOAD) {
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = '/';
        }
    }

    // Typed.js initialization (only on home page)
    if (document.querySelector('.typed-text')) {
        const typed = new Typed('.typed-text', {
            strings: [
                'Web Developer \u2728',  // Sparkles
                'UI Designer \u{1F3A8}',  // Artist Palette
                'Full-Stack Developer \u26A1',  // High Voltage
                'Hotel Management Student \u{1F3E8}'  // Hotel
            ],
            typeSpeed: 50,
            backSpeed: 30,
            loop: true,
            backDelay: 1500,
            cursorChar: '|'
        });
    }

    // Project cards hover effect
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Button hover animation
    const buttons = document.querySelectorAll('.cta-button, .project-button, .submit-button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function(e) {
            const x = e.pageX - this.offsetLeft;
            const y = e.pageY - this.offsetTop;
            
            const ripple = document.createElement('span');
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Navigation button animation
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            
            // Remove flash from all buttons
            document.querySelectorAll('.nav-button').forEach(btn => {
                btn.classList.remove('flash');
                btn.offsetHeight; // Trigger reflow
            });
            
            // Add flash to clicked button
            this.classList.add('flash');
            
            // Navigate after animation
            setTimeout(() => {
                window.location.href = href;
            }, 800);
        });
    });

    // Get the base API URL from config
    async function getApiBaseUrl() {
        const { default: config } = await import('./config.js');
        return config.SERVER_URL;
    }

    // Form submission with email functionality
    const contactForm = document.querySelector('#contactForm');
    if (contactForm) {
        const submitButton = contactForm.querySelector('button[type="submit"]');
        const formMessage = document.getElementById('formMessage');
        const messageInput = document.getElementById('message');
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        let isSubmitting = false;

        // Function to validate email
        function validateEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }

        // Function to validate inputs and enable/disable message field
        function validateInputs() {
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const isEmailValid = validateEmail(email);

            messageInput.placeholder = isSubmitting ? 'Please wait for the cooldown to finish' : 
                                    (!name || !email || !isEmailValid) ? 'Please fill in name and email first' : 
                                    'Your message';
            
            // Enable/disable submit button instead of message field
            submitButton.disabled = !name || !email || !isEmailValid || isSubmitting;
        }

        // Add input listeners
        nameInput.addEventListener('input', validateInputs);
        emailInput.addEventListener('input', validateInputs);

        // Initial validation
        validateInputs();

        // Function to format time remaining
        function formatTimeRemaining(milliseconds) {
            const hours = Math.floor(milliseconds / (1000 * 60 * 60));
            const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
            
            return {
                hours: Math.max(0, hours),
                minutes: Math.max(0, minutes),
                seconds: Math.max(0, seconds)
            };
        }

        let countdownInterval = null;
        let lastServerSync = 0;
        let currentRemainingMs = 0;

        // Function to update timer display
        function updateTimerDisplay(remainingMs) {
            const countdownElement = document.getElementById('countdown');
            if (!countdownElement) return;

            if (!remainingMs || remainingMs <= 0) {
                countdownElement.style.display = 'none';
                return;
            }

            const time = formatTimeRemaining(remainingMs);
            
            countdownElement.style.display = 'block';
            countdownElement.innerHTML = `
                <div class="timer-container">
                    <div class="timer-label">You can send another message after:</div>
                    <div class="timer-digits">
                        <span class="time-unit">${String(time.hours).padStart(2, '0')}</span>
                        <span class="time-separator">:</span>
                        <span class="time-unit">${String(time.minutes).padStart(2, '0')}</span>
                        <span class="time-separator">:</span>
                        <span class="time-unit">${String(time.seconds).padStart(2, '0')}</span>
                    </div>
                    <div class="timer-labels">
                        <span>Hours</span>
                        <span>Minutes</span>
                        <span>Seconds</span>
                    </div>
                </div>
            `;
        }

        // Function to start countdown timer
        function startCountdownTimer(remainingMs) {
            // Clear any existing interval
            if (countdownInterval) {
                clearInterval(countdownInterval);
            }

            if (!remainingMs || remainingMs <= 0) {
                updateTimerDisplay(0);
                location.reload();
                return;
            }

            currentRemainingMs = remainingMs;
            lastServerSync = Date.now();
            
            updateTimerDisplay(currentRemainingMs);
            
            countdownInterval = setInterval(() => {
                // Decrease by exactly 1 second
                currentRemainingMs = Math.max(0, currentRemainingMs - 1000);
                
                if (currentRemainingMs <= 0) {
                    clearInterval(countdownInterval);
                    updateTimerDisplay(0);
                    location.reload();
                } else {
                    updateTimerDisplay(currentRemainingMs);
                }
            }, 1000);
        }

        // Function to check cooldown status
        async function checkCooldownStatus() {
            try {
                const baseUrl = await getApiBaseUrl();
                const response = await fetch(`${baseUrl}/api/check-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const data = await response.json();
                
                if (!data.allowed && data.remainingMs > 0) {
                    // Only update timer if it's significantly different from our current time
                    const timeDiff = Math.abs(currentRemainingMs - data.remainingMs);
                    if (timeDiff > 5000) { // If difference is more than 5 seconds
                        startCountdownTimer(data.remainingMs);
                    }
                    
                    submitButton.disabled = true;
                    nameInput.disabled = true;
                    emailInput.disabled = true;
                    messageInput.disabled = true;
                    formMessage.textContent = data.message;
                    formMessage.style.color = '#ff4444';
                } else {
                    if (countdownInterval) {
                        clearInterval(countdownInterval);
                        countdownInterval = null;
                    }
                    submitButton.disabled = false;
                    nameInput.disabled = false;
                    emailInput.disabled = false;
                    validateInputs();
                }
            } catch (error) {
                console.error('Error checking status:', error);
                formMessage.textContent = 'Error checking status. Please try again later.';
                formMessage.style.color = '#ff4444';
            }
        }

        // Check cooldown status immediately and periodically (every 30 seconds)
        checkCooldownStatus();
        setInterval(checkCooldownStatus, 30000);

        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (isSubmitting) return;
            
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const message = messageInput.value.trim();
            
            if (!name || !email || !message) {
                formMessage.textContent = 'Please fill in all fields';
                formMessage.style.color = '#ff4444';
                return;
            }
            
            if (!validateEmail(email)) {
                formMessage.textContent = 'Please enter a valid email address';
                formMessage.style.color = '#ff4444';
                return;
            }
            
            isSubmitting = true;
            submitButton.disabled = true;
            formMessage.textContent = 'Sending message...';
            formMessage.style.color = '#666';
            
            try {
                const baseUrl = await getApiBaseUrl();
                const response = await fetch(`${baseUrl}/api/contact`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, email, message }),
                    credentials: 'include'
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    formMessage.textContent = data.message;
                    formMessage.style.color = '#4CAF50';
                    contactForm.reset();
                    
                    // Show success message for 5 seconds before showing timer
                    setTimeout(() => {
                        // Start the cooldown timer
                        if (data.remainingMs) {
                            startCountdownTimer(data.remainingMs);
                            nameInput.disabled = true;
                            emailInput.disabled = true;
                            messageInput.disabled = true;
                        }
                    }, 5000);
                } else {
                    if (data.remainingMs) {
                        startCountdownTimer(data.remainingMs);
                        nameInput.disabled = true;
                        emailInput.disabled = true;
                        messageInput.disabled = true;
                        formMessage.textContent = data.error;
                        formMessage.style.color = '#ff4444';
                    } else {
                        throw new Error(data.error || 'Failed to send message');
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                formMessage.textContent = error.message || 'An error occurred. Please try again later.';
                formMessage.style.color = '#ff4444';
                submitButton.disabled = false;
            } finally {
                isSubmitting = false;
            }
        });
    }
});
