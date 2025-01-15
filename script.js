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
        let isSubmitting = false; // Flag to prevent multiple submissions

        // Function to update cooldown timer
        function updateCooldownTimer(timeLeft) {
            if (!timeLeft || timeLeft.totalMs <= 0) {
                if (formMessage) {
                    formMessage.textContent = '';
                }
                submitButton.disabled = false;
                submitButton.textContent = 'Send Message';
                isSubmitting = false;
                return;
            }

            // Calculate time components
            let totalSeconds = Math.ceil(timeLeft.totalMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            // Update the display
            submitButton.disabled = true;
            submitButton.textContent = `Wait ${hours}h ${minutes}m ${seconds}s`;
            isSubmitting = true;
        }

        // Function to check cooldown status
        async function checkCooldownStatus() {
            try {
                const baseUrl = await getApiBaseUrl();
                const response = await fetch(`${baseUrl}/api/check-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                if (!data.canSendMessage) {
                    updateCooldownTimer(data.timeLeft);
                }
            } catch (error) {
                console.error('Error checking cooldown status:', error);
            }
        }

        // Check cooldown status immediately
        checkCooldownStatus();

        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (isSubmitting) {
                return;
            }

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const message = document.getElementById('message').value.trim();

            if (!name || !email || !message) {
                formMessage.textContent = 'Please fill in all fields';
                formMessage.style.color = 'red';
                return;
            }

            try {
                isSubmitting = true;
                submitButton.disabled = true;
                submitButton.textContent = 'Sending...';
                formMessage.textContent = '';

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
                    formMessage.textContent = 'Message sent successfully!';
                    formMessage.style.color = 'green';
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
                submitButton.disabled = false;
                submitButton.textContent = 'Send Message';
                isSubmitting = false;
            }
        });
    }
});
