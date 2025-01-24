// Function to load Typed.js if not already loaded
function loadTypedJs() {
    if (window.Typed) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/typed.js@2.0.12';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Improved font loading with timeout
async function loadFonts() {
    try {
        if (!document.fonts) {
            document.body.classList.add('fonts-loaded');
            return;
        }

        // Pre-load emojis in memory
        const preloadSpan = document.createElement('span');
        preloadSpan.style.opacity = '0';
        preloadSpan.style.position = 'absolute';
        preloadSpan.style.pointerEvents = 'none';
        preloadSpan.textContent = '🌐🎨⚡🏨';
        document.body.appendChild(preloadSpan);

        // Load emoji fonts with timeout
        const fontLoadPromises = [
            document.fonts.load('10pt "Apple Color Emoji"'),
            document.fonts.load('10pt "Segoe UI Emoji"'),
            document.fonts.load('10pt "Segoe UI Symbol"'),
            document.fonts.load('10pt "Noto Color Emoji"')
        ];

        // Add a timeout of 2 seconds for font loading
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2000));
        await Promise.race([Promise.all(fontLoadPromises), timeoutPromise]);

        // Cleanup
        document.body.removeChild(preloadSpan);
        
        // Mark fonts as loaded
        document.body.classList.add('fonts-loaded');
        
        // Initialize typewriter after a small delay to ensure fonts are rendered
        setTimeout(initTypewriter, 100);
    } catch (err) {
        console.log('Font loading error:', err);
        document.body.classList.add('fonts-loaded');
        initTypewriter();
    }
}

// Custom typewriter animation
const texts = [
    'Web Developer 🌐',
    'UI Designer 🎨',
    'Full-Stack Developer ⚡',
    'Hotel Management Student 🏨'
];

let textIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingDelay = 100;
let typewriterInitialized = false;

// Add random variation to typing speed for more natural effect
function getRandomDelay(base, variation) {
    return Math.random() * variation + base;
}

function initTypewriter() {
    if (typewriterInitialized) return;
    typewriterInitialized = true;
    
    const typewriterElement = document.querySelector('.typewriter');
    if (typewriterElement) {
        typewriterElement.style.visibility = 'visible';
        typeWriter();
    }
}

function typeWriter() {
    const currentText = texts[textIndex];  
    const typewriterElement = document.querySelector('.typewriter');
    const cursor = document.querySelector('.cursor');
    
    if (!typewriterElement || !cursor) {
        console.error('Typewriter or cursor element not found');
        return;
    }

    if (isDeleting) {
        typewriterElement.textContent = currentText.substring(0, charIndex - 1);
        typewriterElement.appendChild(cursor);
        charIndex--;
        typingDelay = getRandomDelay(30, 20);
    } else {
        typewriterElement.textContent = currentText.substring(0, charIndex + 1);
        typewriterElement.appendChild(cursor);
        charIndex++;
        typingDelay = getRandomDelay(80, 40);
    }

    // Check if word is complete
    if (!isDeleting && charIndex === currentText.length) {
        isDeleting = true;
        typingDelay = 2000; // Longer pause at the end
    }

    // Check if word is deleted
    if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % texts.length;
        typingDelay = 500; // Pause before starting next word
    }

    setTimeout(typeWriter, typingDelay);
}

// Navigation button shine effect
function initNavigation() {
    const buttons = document.querySelectorAll('.nav-button');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (this.classList.contains('flash')) return;
            
            this.classList.add('flash');

            setTimeout(() => {
                this.classList.remove('flash');
                window.location.href = this.href;
            }, 1000);
        });
    });
}

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

// Contact form submission
const contactForm = document.querySelector('#contactForm');
if (contactForm) {
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const formMessage = document.querySelector('#formMessage');
    let timerInterval;

    // Function to update timer display
    function updateTimerDisplay(remainingTime) {
        const countdownElement = document.getElementById('countdown');
        if (!countdownElement) return;

        if (remainingTime <= 0) {
            countdownElement.style.display = 'none';
            submitButton.disabled = false;
            formMessage.textContent = '';
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            return;
        }

        const { hours, minutes, seconds } = formatTimeRemaining(remainingTime);
        countdownElement.style.display = 'block';
        countdownElement.innerHTML = `
            <div class="countdown-item">
                <span class="countdown-value">${hours}</span>
                <span class="countdown-label">Hours</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-value">${minutes}</span>
                <span class="countdown-label">Minutes</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-value">${seconds}</span>
                <span class="countdown-label">Seconds</span>
            </div>
        `;

        // Update every second
        if (!timerInterval) {
            timerInterval = setInterval(() => {
                remainingTime -= 1000;
                if (remainingTime <= 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    checkCooldown(); // Verify with server when timer ends
                } else {
                    updateTimerDisplay(remainingTime);
                }
            }, 1000);
        }
    }

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
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
            }
        } catch (error) {
            console.error('Error checking cooldown:', error);
            // On error, check again after 5 seconds
            setTimeout(checkCooldown, 5000);
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
                
                // Check cooldown status immediately after successful send
                checkCooldown();
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
    
    // Periodically check cooldown status with server (every 30 seconds)
    setInterval(checkCooldown, 30000);
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

// Move the page refresh code after typed.js initialization
if (window.performance && window.performance.navigation.type === window.performance.navigation.TYPE_RELOAD) {
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        window.location.href = '/';
    }
}

// Load Twemoji
const twemojiScript = document.createElement('script');
twemojiScript.src = 'https://cdn.jsdelivr.net/npm/twemoji@14.0.2/dist/twemoji.min.js';
document.head.appendChild(twemojiScript);

// Initialize everything when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    loadFonts();
});
