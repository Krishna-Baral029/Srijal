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
            strings: ['Web Developer', 'UI Designer', 'Full Stack Developer', 'Problem Solver'],
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
        const { default: config } = await import('./js/config.js');
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

            messageInput.disabled = !(name && email && isEmailValid) || isSubmitting;
            messageInput.placeholder = isSubmitting ? 'Please wait for the cooldown to finish' : 
                                    (!name || !email || !isEmailValid) ? 'Please fill in name and email first' : 
                                    'Your message';
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
                hours,
                minutes,
                seconds,
                formatted: `${hours}h ${minutes}m ${seconds}s`
            };
        }

        // Function to update cooldown timer display
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
                    <div class="timer-label">Time remaining until next message:</div>
                    <div class="timer-digits">
                        <span class="time-unit">${time.hours.toString().padStart(2, '0')}</span>
                        <span class="time-separator">:</span>
                        <span class="time-unit">${time.minutes.toString().padStart(2, '0')}</span>
                        <span class="time-separator">:</span>
                        <span class="time-unit">${time.seconds.toString().padStart(2, '0')}</span>
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
            if (!remainingMs || remainingMs <= 0) return;
            
            updateTimerDisplay(remainingMs);
            
            const timerInterval = setInterval(() => {
                remainingMs -= 1000;
                
                if (remainingMs <= 0) {
                    clearInterval(timerInterval);
                    updateTimerDisplay(0);
                    location.reload(); // Refresh page when timer completes
                } else {
                    updateTimerDisplay(remainingMs);
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
                    startCountdownTimer(data.remainingMs);
                    submitButton.disabled = true;
                    nameInput.disabled = true;
                    emailInput.disabled = true;
                    messageInput.disabled = true;
                } else {
                    nameInput.disabled = false;
                    emailInput.disabled = false;
                    validateInputs();
                }
            } catch (error) {
                console.error('Error checking cooldown status:', error);
                // Keep the form enabled if there's an error checking status
                nameInput.disabled = false;
                emailInput.disabled = false;
                validateInputs();
            }
        }

        // Check cooldown status immediately and every 3 seconds
        checkCooldownStatus();
        const statusInterval = setInterval(checkCooldownStatus, 3000);

        // Clean up interval when page is unloaded
        window.addEventListener('unload', () => {
            clearInterval(statusInterval);
        });

        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (isSubmitting) {
                return;
            }

            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const message = messageInput.value.trim();

            if (!name || !email || !message) {
                formMessage.textContent = 'Please fill in all fields';
                formMessage.style.color = 'red';
                return;
            }

            if (!validateEmail(email)) {
                formMessage.textContent = 'Please enter a valid email address';
                formMessage.style.color = 'red';
                return;
            }

            try {
                isSubmitting = true;
                submitButton.disabled = true;
                submitButton.textContent = 'Sending...';
                formMessage.textContent = 'Sending your message...';
                formMessage.style.color = '#64ffda';
                validateInputs();

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

                if (data.success) {
                    formMessage.innerHTML = 'Message Sent Successfully ✅ <i class="fas fa-check-circle success-icon"></i>';
                    formMessage.style.color = '#64ffda';
                    formMessage.classList.add('success-animation');
                    submitButton.textContent = 'Send Message';
                    submitButton.disabled = true;
                    contactForm.reset();
                    
                    // Update cooldown timer immediately
                    if (data.remainingMs) {
                        startCountdownTimer(data.remainingMs);
                    } else {
                        // Default 12-hour cooldown if remainingMs is not provided
                        startCountdownTimer(12 * 60 * 60 * 1000);
                    }
                    
                    // Disable form inputs during cooldown
                    nameInput.disabled = true;
                    emailInput.disabled = true;
                    messageInput.disabled = true;
                } else {
                    if (data.remainingMs) {
                        startCountdownTimer(data.remainingMs);
                        formMessage.textContent = `Please wait ${Math.floor(data.remainingMs / (60 * 60 * 1000))} hours before sending another message`;
                    } else {
                        throw new Error(data.error || 'Failed to send message');
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                formMessage.textContent = error.message || 'Failed to send message. Please try again later.';
                formMessage.style.color = 'red';
                submitButton.textContent = 'Send Message';
            } finally {
                isSubmitting = false;
                validateInputs();
            }
        });
    }
});
