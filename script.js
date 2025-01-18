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

        // Function to update cooldown timer
        function updateCooldownTimer(timeLeft) {
            if (!timeLeft || timeLeft.totalMs <= 0) {
                if (formMessage) {
                    formMessage.textContent = '';
                }
                submitButton.disabled = false;
                submitButton.textContent = 'Send Message';
                isSubmitting = false;
                validateInputs();
                return;
            }

            // Calculate time components
            let totalSeconds = Math.ceil(timeLeft.totalMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            // Format the time components to handle singular/plural
            const hourText = hours === 1 ? 'hour' : 'hours';
            const minuteText = minutes === 1 ? 'minute' : 'minutes';
            const secondText = seconds === 1 ? 'second' : 'seconds';

            // Create a readable time string
            let timeString = '';
            if (hours > 0) timeString += `${hours} ${hourText}`;
            if (minutes > 0) timeString += timeString ? `, ${minutes} ${minuteText}` : `${minutes} ${minuteText}`;
            if (seconds > 0 || (!hours && !minutes)) timeString += timeString ? `, and ${seconds} ${secondText}` : `${seconds} ${secondText}`;

            // Update the display with a more friendly message
            submitButton.disabled = true;
            formMessage.textContent = `Please wait ${timeString} before sending another message.`;
            formMessage.style.color = '#64ffda';
            isSubmitting = true;
            validateInputs();

            // Update the timer every second
            setTimeout(() => {
                updateCooldownTimer({
                    totalMs: timeLeft.totalMs - 1000
                });
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
                
                const data = await response.json();
                if (!data.canSendMessage && data.timeLeft) {
                    updateCooldownTimer(data.timeLeft);
                }
            } catch (error) {
                console.error('Error checking cooldown status:', error);
            }
        }

        // Check cooldown status immediately and every minute
        checkCooldownStatus();
        setInterval(checkCooldownStatus, 60000);

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
                    body: JSON.stringify({ name, email, message })
                });

                const data = await response.json();

                if (data.success) {
                    formMessage.textContent = 'Message sent successfully! ✅';
                    formMessage.style.color = 'green';
                    submitButton.textContent = 'Message Sent Successfully';
                    contactForm.reset();
                    if (data.timeLeft) {
                        updateCooldownTimer(data.timeLeft);
                    }
                } else {
                    throw new Error(data.error || 'Failed to send message');
                }
            } catch (error) {
                console.error('Error:', error);
                formMessage.textContent = error.message || 'Failed to send message. Please try again later.';
                formMessage.style.color = 'red';
                isSubmitting = false;
                submitButton.disabled = false;
                submitButton.textContent = 'Send Message';
            }
            validateInputs();
        });
    }
});
