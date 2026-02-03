document.addEventListener('DOMContentLoaded', () => {

    // =========================================
    // 1. MODERN LOADING SCREEN
    // =========================================
    const loader = document.getElementById('loader');

    if (loader) {
        // Prevent scrolling during boot
        document.body.style.overflow = 'hidden';

        // Loading text animation
        const loadingTexts = [
            "Initializing...",
            "Loading resources...",
            "Connecting to server...",
            "Almost ready..."
        ];

        const loadingTextElement = document.querySelector('.loading-text');
        let textIndex = 0;

        const textInterval = setInterval(() => {
            textIndex = (textIndex + 1) % loadingTexts.length;
            if (loadingTextElement) {
                loadingTextElement.textContent = loadingTexts[textIndex];
            }
        }, 800);

        // Auto-hide loader after animation completes
        setTimeout(() => {
            clearInterval(textInterval);
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.8s ease';
            setTimeout(() => {
                loader.style.display = 'none';
                document.body.classList.remove('loading');
                document.body.style.overflow = '';
                triggerHeroAnimations();
            }, 800);
        }, 4000); // Total loading time
    } else {
        // No loader, ensure body is ready
        document.body.classList.remove('loading');
        document.body.style.overflow = '';
        triggerHeroAnimations();
    }

    // =========================================
    // 2. CUSTOM CURSOR (TACTICAL HUD)
    // =========================================
    const customCursor = document.getElementById('custom-cursor');

    // Only run cursor logic on non-touch devices
    if (customCursor && window.matchMedia("(pointer: fine)").matches) {
        window.addEventListener('mousemove', (e) => {
            const posX = e.clientX;
            const posY = e.clientY;

            // Direct movement (CSS transition handles smoothness)
            customCursor.style.left = `${posX}px`;
            customCursor.style.top = `${posY}px`;
        });

        // Loop hover listeners to items
        const interactiveSelectors = 'a, button, input, textarea, .service-card, .portfolio-item';

        document.body.addEventListener('mouseover', (e) => {
            if (e.target.closest(interactiveSelectors)) {
                document.body.classList.add('hovering');
            } else {
                document.body.classList.remove('hovering');
            }
        });
    }

    // =========================================
    // 3. MOBILE MENU
    // =========================================
    const menuToggle = document.getElementById('mobile-menu');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    menuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        menuToggle.classList.toggle('active'); // You might want to style the hamburger into an X
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            menuToggle.classList.remove('active');
        });
    });

    // Sticky Header
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // =========================================
    // 4. CANVAS PARTICLES
    // =========================================
    // =========================================
    // 4. MATRIX BACKGROUND ANIMATION
    // =========================================
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');

    let width, height;
    let drops = [];
    const fontSize = 16;
    const chars = "10"; // Binary for 'Tech' feel

    function initMatrix() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;

        const columns = Math.ceil(width / fontSize);
        drops = [];
        for (let i = 0; i < columns; i++) {
            // Random start positions above (negative) to staggered start
            drops[i] = Math.random() * -100;
        }
    }

    // Resize handler
    window.addEventListener('resize', initMatrix);
    initMatrix();

    function animateMatrix() {
        // Create trail effect with semi-transparent background
        // Using --bg-dark color #050507
        ctx.fillStyle = 'rgba(5, 5, 7, 0.1)';
        ctx.fillRect(0, 0, width, height);

        ctx.font = '14px "Space Mono", monospace';

        for (let i = 0; i < drops.length; i++) {
            // Randomly pick color from theme palette for each char
            // Primary (#4f46e5), Secondary (#7c3aed), Cyan (#06b6d4)
            const colors = ['#4f46e5', '#7c3aed', '#06b6d4'];
            ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];

            // Random character 0 or 1
            const text = chars[Math.floor(Math.random() * chars.length)];

            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            // Reset drop to top randomly after it falls off screen
            if (drops[i] * fontSize > height && Math.random() > 0.985) {
                drops[i] = 0;
            }

            drops[i]++;
        }

        requestAnimationFrame(animateMatrix);
    }

    // Start animation
    animateMatrix();

    // =========================================
    // 5. OBSERVER & ANIMATIONS
    // =========================================
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                if (entry.target.classList.contains('hero-stats')) {
                    animateStats();
                }
            }
        });
    }, observerOptions);

    document.querySelectorAll('.hero-content, .service-card, .section-title').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
        observer.observe(el);
    });

    // Add class for visible state styling triggers if needed, currently inline styles above handling it
    // But better to use class for cleaner separation.
    // Let's inject a style rule for .visible
    const style = document.createElement('style');
    style.innerHTML = `
        .visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);


    function triggerHeroAnimations() {
        // Specific hero sequence if needed
    }

    // Stats Counter
    let statsAnimated = false;
    function animateStats() {
        if (statsAnimated) return;
        statsAnimated = true;
        const stats = document.querySelectorAll('.stat-number');
        stats.forEach(stat => {
            const target = +stat.getAttribute('data-target');
            const inc = target / 100;
            let count = 0;
            const updateCount = () => {
                count += inc;
                if (count < target) {
                    stat.innerText = Math.ceil(count);
                    requestAnimationFrame(updateCount);
                } else {
                    stat.innerText = target;
                }
            };
            updateCount();
        });
    }






    // =========================================
    // 8. CONTACT FORM SUBMISSION
    // =========================================
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData.entries());

        // Simple loading state
        const submitBtn = contactForm.querySelector('button');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Sending...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                formStatus.innerHTML = `<p style="color: var(--emerald); margin-top: 10px;">${result.message}</p>`;
                contactForm.reset();
            } else {
                formStatus.innerHTML = `<p style="color: #ef4444; margin-top: 10px;">${result.message}</p>`;
            }
        } catch (error) {
            formStatus.innerHTML = `<p style="color: #ef4444; margin-top: 10px;">Something went wrong. Please try again.</p>`;
        } finally {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    });

});
