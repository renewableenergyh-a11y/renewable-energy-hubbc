// Detect if running on file:// protocol (local file, no server)
const isLocalFile = window.location.protocol === 'file:';

// Handler for course button clicks - check if user is logged in
// Make it globally accessible by attaching to window
window.handleCourseButtonClick = function(event, href) {
  event.preventDefault();
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  
  if (!isLoggedIn) {
    // Redirect to login with return URL
    window.location.href = `login.html?redirect=${encodeURIComponent(href)}`;
  } else {
    // User is logged in, navigate to courses
    window.location.href = href;
  }
};

// Carousel slides - each with title, text, button
const carouselImages = [
  {
    src: 'https://www.ificlaims.com/wp-content/uploads/sites/3/2023/01/AdobeStock_847018064-scaled.jpeg',
    alt: 'Renewable Energy - Overview',
    title: 'Learn Renewable Energy Today',
    text: 'Solar, Wind, Hydro, Biomass, and Geothermal energy resources all in one place.',
    buttonText: 'Explore Courses',
    buttonHref: 'courses.html'
  },
  {
    src: 'https://ecesolar.in/blog/wp-content/uploads/2025/09/blog_preview_banner_5.webp',
    alt: 'Solar Energy - Photovoltaic Panels',
    title: 'Solar Energy Made Simple',
    text: 'Learn how photovoltaic panels convert sunlight into clean electricity.',
    buttonText: 'Explore Solar Courses',
    buttonHref: 'courses.html?filter=solar'
  },
  {
    src: 'https://w0.peakpx.com/wallpaper/404/326/HD-wallpaper-wind-power-wind-turbines-alternative-energy-energy-blue-sky.jpg',
    alt: 'Wind Energy - Wind Turbines',
    title: 'Harness the Wind',
    text: 'Understand turbine design, siting, and grid integration.',
    buttonText: 'Register Now',
    buttonHref: 'register.html'
  },
  {
    src: 'https://png.pngtree.com/thumb_back/fh260/background/20230613/pngtree-large-dam-with-water-running-out-of-it-image_2943186.jpg',
    alt: 'Hydroelectric Energy - Dam',
    title: 'Power from Water',
    text: 'Explore hydro systems, environmental impact, and operations.',
    buttonText: 'View Hydro Courses',
    buttonHref: 'courses.html?filter=hydro'
  },
  {
    src: 'https://c4.wallpaperflare.com/wallpaper/848/340/993/geyser-geological-phenomenon-geothermal-sky-wallpaper-preview.jpg',
    alt: 'Geothermal Energy',
    title: 'Geothermal Fundamentals',
    text: 'Discover subsurface energy and sustainable heating solutions.',
    buttonText: 'Learn More',
    buttonHref: 'courses.html?filter=geothermal'
  },
  {
    src: 'https://www.shutterstock.com/shutterstock/videos/1058923301/thumb/1.jpg?ip=x480',
    alt: 'Biomass Energy - Renewable Farm',
    title: 'Biomass & Bioenergy',
    text: 'From feedstock to energy—practical courses for biomass projects.',
    buttonText: 'Explore Biomass',
    buttonHref: 'courses.html?filter=biomass'
  }
];

// Initialize carousel
function initCarousel() {
  const track = document.getElementById('carousel-track');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  const indicatorsContainer = document.getElementById('carousel-indicators');
  
  if (!track) return;
  
  let currentIndex = 0;
  const slideCount = carouselImages.length;
  let autoScrollInterval;
  
  // Render slides with per-slide overlay
  carouselImages.forEach((img, idx) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    const buttonHref = img.buttonHref;
    // Check if this button links to courses (protected route)
    const isCoursesLink = buttonHref.includes('courses.html');
    const onClickHandler = isCoursesLink ? `onclick="handleCourseButtonClick(event, '${buttonHref}')"` : '';
    
    slide.innerHTML = `
      <img src="${img.src}" alt="${img.alt}" />
      <div class="slide-overlay">
        <div class="slide-content">
          <h3>${img.title}</h3>
          <p>${img.text}</p>
          <a href="${isCoursesLink ? '#' : buttonHref}" ${onClickHandler} class="btn-primary">${img.buttonText}</a>
        </div>
      </div>
    `;
    track.appendChild(slide);
  });
  
  // Render indicators
  carouselImages.forEach((_, idx) => {
    const indicator = document.createElement('button');
    indicator.className = 'carousel-indicator' + (idx === 0 ? ' active' : '');
    indicator.setAttribute('aria-label', `Go to slide ${idx + 1}`);
    indicator.addEventListener('click', () => goToSlide(idx));
    indicatorsContainer.appendChild(indicator);
  });
  
  function updateCarousel() {
    track.style.transform = `translateX(-${currentIndex * 100}%)`;
    
    // Update indicators
    document.querySelectorAll('.carousel-indicator').forEach((ind, idx) => {
      ind.classList.toggle('active', idx === currentIndex);
    });
  }
  
  function goToSlide(idx) {
    currentIndex = idx;
    updateCarousel();
    resetAutoScroll();
  }
  
  function nextSlide() {
    currentIndex = (currentIndex + 1) % slideCount;
    updateCarousel();
    resetAutoScroll();
  }
  
  function prevSlide() {
    currentIndex = (currentIndex - 1 + slideCount) % slideCount;
    updateCarousel();
    resetAutoScroll();
  }
  
  function startAutoScroll() {
    autoScrollInterval = setInterval(nextSlide, 6000); // Change slide every 6 seconds
  }
  
  function resetAutoScroll() {
    clearInterval(autoScrollInterval);
    startAutoScroll();
  }
  
  prevBtn.addEventListener('click', prevSlide);
  nextBtn.addEventListener('click', nextSlide);
  
  // Mouse over to pause, mouse out to resume
  const viewer = document.querySelector('.carousel-viewer');
  viewer.addEventListener('mouseenter', () => clearInterval(autoScrollInterval));
  viewer.addEventListener('mouseleave', startAutoScroll);
  
  // Start auto-scroll
  startAutoScroll();
}

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize carousel first
  initCarousel();
  const featuredCoursesContainer = document.getElementById("featured-courses");

  if (!featuredCoursesContainer) return;

  try {
    console.log('🔄 Fetching courses...');
    let courses = [];
    
    // If running locally, try to load courses from data/courses.json
    if (isLocalFile) {
      console.log(`📁 Attempting to load local courses: data/courses.json`);
      const resLocal = await fetch('data/courses.json');
      if (!resLocal.ok) throw new Error('Local courses.json not found');
      courses = await resLocal.json();
      console.log('✅ Local courses loaded:', courses);
    } else {
      // Use StorageSync to load from server and cache to localStorage
      courses = await StorageSync.loadAndSyncCourses();
      console.log('✅ Courses loaded:', courses);
    }

    // Render featured courses (no premium checks on courses)
    featuredCoursesContainer.innerHTML = courses
      .map(course => {
        const desc = course.description || "";
        const shortDesc = desc.length > 120 ? desc.slice(0, 117).trim() + '…' : desc;
        
        return `
          <div class="lesson-card">
            <img src="${course.image}" alt="${course.title}" class="lesson-image">
            <h3>${course.title}</h3>
            <p>${shortDesc}</p>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error('❌ Error loading courses:', err);
    // Fallback to trying local courses file
    console.log(`↩️ Trying local fallback: data/courses.json`);
    let fallbackCourses = [];
    try {
      const resLocal = await fetch('data/courses.json');
      if (resLocal.ok) fallbackCourses = await resLocal.json();
    } catch (lf) {
      console.warn('⚠️ Local courses fallback failed:', lf);
    }

    featuredCoursesContainer.innerHTML = fallbackCourses
      .map(course => {
        const desc = course.description || "";
        const shortDesc = desc.length > 120 ? desc.slice(0, 117).trim() + '…' : desc;
        
        return `
          <div class="lesson-card">
            <img src="${course.image}" alt="${course.title}" class="lesson-image">
            <h3>${course.title}</h3>
            <p>${shortDesc}</p>
          </div>
        `;
      })
      .join("");
  }
});
