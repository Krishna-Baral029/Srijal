document.addEventListener('DOMContentLoaded', function() {
    // Start typed.js immediately
    const typedElement = document.querySelector('.typed-text');
    if (typedElement) {
        const typed = new Typed('.typed-text', {
            strings: [
                'Web Developer  ',  
                'UI Designer  ',    
                'Full-Stack Developer  ',  
                'Hotel Management Student  '   
            ],
            typeSpeed: 50,      // Back to original speed
            backSpeed: 30,      // Back to original speed
            loop: true,
            backDelay: 1500,    // Back to original delay
            cursorChar: '|',
            showCursor: false,
            startDelay: 0,      // Start immediately
            onStringTyped: function(arrayPos) {
                // Add emoji after typing is complete for each string
                const emojis = ['🌐', '🎨', '⚡', '🏨'];
                const currentString = typed.el.innerHTML;
                typed.el.innerHTML = currentString.trimEnd() + emojis[arrayPos];
            }
        });
    }

    // Move the page refresh code after typed.js initialization
    if (window.performance && window.performance.navigation.type === window.performance.navigation.TYPE_RELOAD) {
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = '/';
        }
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

    // Function to get API base URL
    function getApiBaseUrl() {
        // Use Render URL in production, localhost in development
        return window.location.hostname === 'localhost' 
            ? 'http://localhost:5000'
            : 'https://srijal-portfolio.onrender.com';
    }

    // Function to validate email
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

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

    // Contact form submission
    const contactForm = document.querySelector('#contactForm');
    if (contactForm) {
        const submitButton = contactForm.querySelector('button[type="submit"]');
        const formMessage = document.querySelector('.form-message');
        
        // Function to check cooldown status
        async function checkCooldown() {
            try {
                const baseUrl = getApiBaseUrl();
                const response = await fetch(`${baseUrl}/api/check-cooldown`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (!data.canSend) {
                    submitButton.disabled = true;
                    updateTimerDisplay(data.remainingTime);
                    formMessage.textContent = 'Please wait before sending another message';
                    formMessage.style.color = '#ff4444';
                } else {
                    submitButton.disabled = false;
                    formMessage.textContent = '';
                    const countdownElement = document.getElementById('countdown');
                    if (countdownElement) {
                        countdownElement.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error('Error checking cooldown:', error);
            }
        }

        // Contact form submission
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;
            
            if (!name || !email || !message) {
                formMessage.textContent = 'Please fill in all fields';
                formMessage.style.color = '#ff4444';
                return;
            }
            
            submitButton.disabled = true;
            formMessage.textContent = 'Sending message...';
            
            try {
                const baseUrl = getApiBaseUrl();
                const response = await fetch(`${baseUrl}/api/send-message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, email, message })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    formMessage.textContent = 'Message sent successfully!';
                    formMessage.style.color = '#64ffda';
                    contactForm.reset();
                    
                    // Check cooldown status after successful send
                    setTimeout(checkCooldown, 1000);
                } else {
                    formMessage.textContent = data.error;
                    formMessage.style.color = '#ff4444';
                    if (data.remainingTime) {
                        updateTimerDisplay(data.remainingTime);
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                formMessage.textContent = 'Error sending message. Please try again.';
                formMessage.style.color = '#ff4444';
            } finally {
                submitButton.disabled = false;
            }
        });

        // Check cooldown on page load
        checkCooldown();
        
        // Periodically check cooldown status
        setInterval(checkCooldown, 30000); // Every 30 seconds
    }
});
