import { getModulesForCourse, getModuleContent } from "../core/moduleService.js";
import { renderMarkdown } from "../components/markdownRenderer.js";
import { logModuleView, logQuizCompletion } from "../core/attendanceService.js";
import { getToken } from "../core/auth.js";
import { renderComments } from "../components/commentsComponent.js";
import { awardPoints } from "../core/gamificationService.js";
import { fetchHighlights, saveHighlight, updateHighlight, deleteHighlight, getTextSelection, applyHighlightToDOM, removeHighlightFromDOM, findHighlightSpans, reapplyHighlights } from "../core/highlightService.js";
import { HighlightToolbar } from "../components/highlightToolbar.js";

let moduleStartTime = Date.now();
let moduleId = null;
let courseId = null;
let gamificationAwardedForView = false;

// Highlighting system variables
let highlightToolbar = null;
const highlightedSpans = new Map(); // tempId/serverId -> { spanElement, serverId }
let pendingHighlights = []; // Highlights waiting for server response

document.addEventListener("DOMContentLoaded", async () => {
  // Check if user is logged in
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) {
    const container = document.getElementById("module-content");
    if (container) {
      container.innerHTML = '<div style="text-align: center; padding: 40px;"><p style="font-size: 18px; margin-bottom: 20px;">You must be logged in to access modules.</p><a href="login.html" class="btn-primary" style="display: inline-block; margin-top: 20px;">Go to Login</a></div>';
    }
    return;
  }

  // Stop any ongoing speech synthesis before loading new module
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  // Stop read aloud when leaving the page
  window.addEventListener('beforeunload', () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  });

  const params = new URLSearchParams(window.location.search);
  courseId = params.get("course");
  moduleId = params.get("module");
  moduleStartTime = Date.now();

  const container = document.getElementById("module-content");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const quizLock = document.getElementById("quizLock");
  const startQuizBtn = document.getElementById("startQuiz");
  const quizContent = document.getElementById("quiz-content");

  if (!courseId || !moduleId) {
    container.innerHTML = "<p>Invalid module link.</p>";
    return;
  }

  try {
    const modules = await getModulesForCourse(courseId);
    const module = modules.find(m => m.id === moduleId);

    if (!module) {
      container.innerHTML = "<p>Module not found.</p>";
      return;
    }

    // Award points for viewing module
    if (getToken() && !gamificationAwardedForView) {
      awardPoints('module_view', { moduleId, courseId });
      gamificationAwardedForView = true;

      // Check for module viewing milestones
      if (typeof notificationTriggers !== 'undefined') {
        notificationTriggers.checkMilestoneReached().catch(err => {
          console.warn('Failed to check milestone notification:', err);
        });
      }
    }

    // Set module title and category
    document.getElementById("module-title").textContent = module.title;
    const categoryText = module.category ? module.category : courseId.charAt(0).toUpperCase() + courseId.slice(1);
    document.getElementById("module-category").textContent = `Category: ${categoryText}`;

    // Display tag
    const tagEl = document.getElementById("module-tag");
    if (module.isPremium) {
      tagEl.textContent = 'Premium';
      tagEl.classList.add('premium');
    } else {
      tagEl.textContent = 'Free';
      tagEl.classList.add('free');
    }

    // Render video if present
    const mediaDiv = document.getElementById('module-media');
    if (mediaDiv) {
      mediaDiv.innerHTML = '';
      if (module.video && module.video.trim()) {
        const hasPremium = localStorage.getItem('hasPremium') === 'true';
        const adminUnlocked = sessionStorage.getItem('adminUnlocked') === 'true';
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        
        // Check if user can view premium content
        const canViewVideo = !module.isPremium || adminUnlocked || (loggedIn && hasPremium);
        
        if (canViewVideo) {
          // Create video card (collapsed state)
          const videoCard = document.createElement('div');
          videoCard.className = 'video-card';
          
          const playIcon = document.createElement('div');
          playIcon.style.fontSize = '36px';
          playIcon.textContent = '▶️';
          playIcon.style.flexShrink = '0';
          
          const cardText = document.createElement('div');
          cardText.style.flex = '1';
          const cardTitle = document.createElement('div');
          cardTitle.style.fontWeight = '600';
          cardTitle.style.fontSize = '15px';
          cardTitle.style.color = 'var(--text-main)';
          cardTitle.textContent = 'Watch Module Video';
          const cardSubtitle = document.createElement('div');
          cardSubtitle.style.fontSize = '12px';
          cardSubtitle.style.color = 'var(--text-secondary)';
          cardSubtitle.style.marginTop = '2px';
          cardSubtitle.textContent = 'Click to watch the video content';
          cardText.appendChild(cardTitle);
          cardText.appendChild(cardSubtitle);
          
          videoCard.appendChild(playIcon);
          videoCard.appendChild(cardText);
          
          // Create video player container (expanded state - initially hidden)
          const videoContainer = document.createElement('div');
          videoContainer.className = 'video-container';
          videoContainer.style.display = 'none';
          
          const videoHeader = document.createElement('div');
          videoHeader.style.background = 'var(--green-main)';
          videoHeader.style.padding = '12px 16px';
          videoHeader.style.display = 'flex';
          videoHeader.style.justifyContent = 'space-between';
          videoHeader.style.alignItems = 'center';
          videoHeader.style.color = 'white';
          
          const headerTitle = document.createElement('div');
          headerTitle.style.fontWeight = '600';
          headerTitle.textContent = 'Module Video';
          
          const closeBtn = document.createElement('button');
          closeBtn.style.background = 'rgba(255,255,255,0.2)';
          closeBtn.style.border = 'none';
          closeBtn.style.color = 'white';
          closeBtn.style.padding = '4px 12px';
          closeBtn.style.borderRadius = '4px';
          closeBtn.style.cursor = 'pointer';
          closeBtn.style.fontSize = '14px';
          closeBtn.style.fontWeight = '600';
          closeBtn.textContent = '✕ Close';
          
          videoHeader.appendChild(headerTitle);
          videoHeader.appendChild(closeBtn);
          
          const videoWrapper = document.createElement('div');
          videoWrapper.style.background = '#000';
          
          const video = document.createElement('video');
          video.style.width = '100%';
          video.style.height = 'auto';
          video.style.display = 'block';
          video.controls = true;
          
          const source = document.createElement('source');
          source.src = module.video;
          // Detect video type from URL
          if (module.video.includes('.mp4') || module.video.includes('.MP4')) {
            source.type = 'video/mp4';
          } else if (module.video.includes('.webm') || module.video.includes('.WEBM')) {
            source.type = 'video/webm';
          } else if (module.video.includes('.mov') || module.video.includes('.MOV')) {
            source.type = 'video/mp4';
          } else if (module.video.includes('.avi') || module.video.includes('.AVI')) {
            source.type = 'video/avi';
          } else if (module.video.includes('.mpeg') || module.video.includes('.MPEG') || module.video.includes('.mpg') || module.video.includes('.MPG')) {
            source.type = 'video/mpeg';
          } else {
            source.type = 'video/mp4';
          }
          
          video.appendChild(source);
          const fallbackText = document.createElement('p');
          fallbackText.textContent = 'Your browser does not support the video tag.';
          video.appendChild(fallbackText);
          
          videoWrapper.appendChild(video);
          videoContainer.appendChild(videoHeader);
          videoContainer.appendChild(videoWrapper);
          
          // Add to media div
          mediaDiv.appendChild(videoCard);
          mediaDiv.appendChild(videoContainer);
          
          // Event handlers for expand/collapse
          videoCard.addEventListener('click', () => {
            videoCard.style.display = 'none';
            videoContainer.style.display = 'block';
          });
          
          closeBtn.addEventListener('click', () => {
            video.pause();
            video.currentTime = 0;
            videoContainer.style.display = 'none';
            videoCard.style.display = 'flex';
          });
        } else {
          // User is not premium but module is premium
          const lockDiv = document.createElement('div');
          lockDiv.style.padding = '24px 20px';
          lockDiv.style.textAlign = 'center';
          lockDiv.style.background = 'linear-gradient(135deg, rgba(0,121,107,0.1), rgba(0,212,168,0.1))';
          lockDiv.style.borderRadius = '8px';
          lockDiv.style.marginBottom = '20px';
          lockDiv.style.border = '2px solid var(--green-main)';
          lockDiv.style.minHeight = '120px';
          lockDiv.style.display = 'flex';
          lockDiv.style.flexDirection = 'column';
          lockDiv.style.justifyContent = 'center';
          lockDiv.style.alignItems = 'center';
          lockDiv.style.gap = '8px';
          
          const lockIcon = document.createElement('div');
          lockIcon.style.fontSize = '48px';
          lockIcon.style.marginBottom = '16px';
          lockIcon.innerHTML = '🔒';
          
          const lockTitle = document.createElement('h3');
          lockTitle.style.margin = '0 0 8px 0';
          lockTitle.style.color = 'var(--text-main)';
          lockTitle.textContent = 'Premium Content';
          
          const lockMsg = document.createElement('p');
          lockMsg.style.margin = '0 0 16px 0';
          lockMsg.style.color = 'var(--text-secondary)';
          lockMsg.textContent = 'This video is available exclusively to premium members.';
          
          const upgradeBtn = document.createElement('a');
          upgradeBtn.href = 'billing.html';
          upgradeBtn.className = 'btn-primary';
          upgradeBtn.style.display = 'inline-block';
          upgradeBtn.style.padding = '10px 24px';
          upgradeBtn.style.marginTop = '8px';
          upgradeBtn.textContent = 'Upgrade to Premium';
          
          lockDiv.appendChild(lockIcon);
          lockDiv.appendChild(lockTitle);
          lockDiv.appendChild(lockMsg);
          lockDiv.appendChild(upgradeBtn);
          mediaDiv.appendChild(lockDiv);
        }
      }
    }

    // Always attempt to load module content here; premium access control happens on the modules list.
    const markdown = await getModuleContent(courseId, module.content);
    // resolve objectives if provided as filename
    let resolvedObjectives = undefined;
    if (module.objectives) {
      if (Array.isArray(module.objectives)) resolvedObjectives = module.objectives;
      else if (typeof module.objectives === 'string') {
        try { const ro = await fetch(`/data/modules/${encodeURIComponent(courseId)}/${encodeURIComponent(module.objectives)}`); if (ro.ok) resolvedObjectives = await ro.json(); } catch (e) { resolvedObjectives = undefined; }
      }
    }
    renderMarkdown(container, markdown, { objectives: resolvedObjectives });

    // Initialize highlighting system
    await initializeHighlighting(container, moduleId, 'module');

    // Helper function for escaping HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Load and render resources
    try {
      let resolvedResources = [];
      if (module.resources) {
        if (Array.isArray(module.resources)) {
          resolvedResources = module.resources;
        } else if (typeof module.resources === 'string') {
          try { 
            const rr = await fetch(`/data/modules/${encodeURIComponent(courseId)}/${encodeURIComponent(module.resources)}`); 
            if (rr.ok) resolvedResources = await rr.json(); 
          } catch (e) { 
            resolvedResources = []; 
          }
        }
      }
      
      const resourcesSection = document.getElementById('module-resources');
      if (resourcesSection && resolvedResources && resolvedResources.length > 0) {
        const resourcesList = resourcesSection.querySelector('ul');
        if (resourcesList) {
          resourcesList.innerHTML = '';
          resolvedResources.forEach(resource => {
            const li = document.createElement('li');
            li.style.marginBottom = '8px';
            if (resource && resource.url) {
              li.innerHTML = `<a href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resource.name || 'Resource')}</a>`;
            } else if (resource && resource.name) {
              li.textContent = escapeHtml(resource.name);
            }
            if (li.textContent || li.innerHTML) {
              resourcesList.appendChild(li);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Error rendering resources:', e);
    }

    // --- Text to Speech / Read Aloud ---
    const readAloudToggle = document.getElementById('module-read-aloud-toggle');
    let isSpeaking = false;
    const speechSynthesis = window.speechSynthesis;
    
    // Check if Speech Synthesis API is available
    if (!speechSynthesis) {
      console.error('❌ Speech Synthesis API not available on this browser');
      if (readAloudToggle) {
        readAloudToggle.disabled = true;
        readAloudToggle.title = 'Speech synthesis not supported on this device';
        readAloudToggle.style.opacity = '0.5';
        readAloudToggle.style.cursor = 'not-allowed';
      }
    } else {
      console.log('✅ Speech Synthesis API is available');
    }
    
    let currentUtterance = null;
    let selectedVoiceIndex = 0;
    let availableVoices = [];

    // Create small notification element
    const voiceNotification = document.createElement('div');
    voiceNotification.style.position = 'fixed';
    voiceNotification.style.bottom = '20px';
    voiceNotification.style.right = '20px';
    voiceNotification.style.background = 'var(--green-main)';
    voiceNotification.style.color = 'white';
    voiceNotification.style.padding = '6px 12px';
    voiceNotification.style.borderRadius = '4px';
    voiceNotification.style.fontSize = '12px';
    voiceNotification.style.zIndex = '9999';
    voiceNotification.style.display = 'none';
    voiceNotification.style.opacity = '0';
    voiceNotification.style.transition = 'opacity 0.3s ease';
    voiceNotification.style.maxWidth = '200px';
    voiceNotification.style.whiteSpace = 'nowrap';
    voiceNotification.style.overflow = 'hidden';
    voiceNotification.style.textOverflow = 'ellipsis';
    document.body.appendChild(voiceNotification);

    function showVoiceNotification(text) {
      voiceNotification.textContent = text;
      voiceNotification.style.display = 'block';
      voiceNotification.style.opacity = '1';
      setTimeout(() => {
        voiceNotification.style.opacity = '0';
        setTimeout(() => {
          voiceNotification.style.display = 'none';
        }, 300);
      }, 2000);
    }

    // Get available voices when they load
    function populateVoices() {
      const allVoices = speechSynthesis.getVoices();
      console.log(`📢 Speech Synthesis available voices: ${allVoices.length}`);
      allVoices.forEach((v, i) => console.log(`  [${i}] ${v.name} (lang: ${v.lang})`));
      
      availableVoices = [];

      // Filter to get only light male and female voices
      let lightMale = null;
      let female = null;

      // First pass: look for explicitly named voices
      for (const voice of allVoices) {
        const voiceName = voice.name.toLowerCase();
        
        // Female voice
        if (!female && (voiceName.includes('female') || voiceName.includes('woman') || voiceName.includes('zira') || voiceName.includes('aria') || voiceName.includes('samantha'))) {
          female = voice;
        }
        
        // Light male
        if (!lightMale && (voiceName.includes('male') || voiceName.includes('man') || voiceName.includes('david') || voiceName.includes('george') || voiceName.includes('james'))) {
          lightMale = voice;
        }
      }

      // Second pass: if not found, just use first two available voices
      if (!female && allVoices.length > 0) {
        female = allVoices[0];
      }
      if (!lightMale && allVoices.length > 1) {
        lightMale = allVoices[1];
      } else if (!lightMale && allVoices.length > 0) {
        lightMale = allVoices[0];
      }

      // Build final two-voice array - store voice objects directly
      if (lightMale) {
        availableVoices.push({ type: 'Light Male', voiceObj: lightMale });
        console.log(`✓ Using Light Male voice: ${lightMale.name}`);
      }
      if (female) {
        availableVoices.push({ type: 'Female', voiceObj: female });
        console.log(`✓ Using Female voice: ${female.name}`);
      }

      if (availableVoices.length > 0) {
        selectedVoiceIndex = 0;
        console.log(`📢 Voice initialization complete: ${availableVoices.length} voices available`);
      } else {
        console.warn('⚠️ No voices available for speech synthesis!');
      }
    }

    // Only set up event handlers if speechSynthesis is available
    if (speechSynthesis && readAloudToggle) {
      speechSynthesis.onvoiceschanged = populateVoices;
      populateVoices();
    }

    if (readAloudToggle && speechSynthesis) {
      // Mobile vs Desktop detection and handlers
      let longPressTimer = null;
      const longPressDuration = 500;
      let isTouchDevice = false;
      
      // Function to toggle read aloud
      const toggleReadAloud = () => {
        if (isSpeaking) {
          // Stop speaking
          speechSynthesis.cancel();
          isSpeaking = false;
          readAloudToggle.style.color = '';
          readAloudToggle.style.opacity = '';
        } else {
          // Start speaking
          const contentElement = document.getElementById('module-content');
          if (!contentElement) {
            showVoiceNotification('Module content not found');
            return;
          }

          // Extract text from content, excluding buttons
          let textToSpeak = contentElement.innerText || contentElement.textContent;
          
          // Remove mark as complete button text and other button text
          textToSpeak = textToSpeak.replace(/✓?\s*Mark as Complete/gi, '').replace(/Complete Module/gi, '');
          
          if (!textToSpeak.trim()) {
            showVoiceNotification('No content to read');
            return;
          }

          // Create utterance
          currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
          currentUtterance.rate = 1;
          currentUtterance.pitch = 1;
          currentUtterance.volume = 1;

          // Set voice if available
          if (availableVoices.length > 0) {
            currentUtterance.voice = availableVoices[selectedVoiceIndex].voiceObj;
          }

          // Handle speech end
          currentUtterance.onend = () => {
            isSpeaking = false;
            readAloudToggle.style.color = '';
            readAloudToggle.style.opacity = '';
          };

          currentUtterance.onerror = (error) => {
            console.error('Speech synthesis error:', error);
            isSpeaking = false;
            readAloudToggle.style.color = '';
            readAloudToggle.style.opacity = '';
            
            // Only show error notification if it's not an intentional interruption
            if (error.error !== 'interrupted') {
              showVoiceNotification('Error reading aloud: ' + error.error);
            } else {
              showVoiceNotification('Read aloud off');
            }
          };

          // Start speaking
          isSpeaking = true;
          readAloudToggle.style.color = 'var(--green-main)';
          readAloudToggle.style.opacity = '1';
          
          // Cancel any ongoing speech before starting new one
          speechSynthesis.cancel();
          
          // Use setTimeout to ensure speech starts (helps with mobile browsers)
          setTimeout(() => {
            try {
              speechSynthesis.speak(currentUtterance);
              showVoiceNotification('Reading aloud...');
            } catch (err) {
              console.error('Failed to start speech synthesis:', err);
              isSpeaking = false;
              readAloudToggle.style.color = '';
              readAloudToggle.style.opacity = '';
              showVoiceNotification('Speech synthesis not supported');
            }
          }, 100);
        }
      };

      // Function to change voice
      const changeVoice = () => {
        console.log(`🎤 changeVoice called. Available voices: ${availableVoices.length}, isSpeaking: ${isSpeaking}`);
        
        if (availableVoices.length === 0) {
          showVoiceNotification('No voices available');
          return;
        }
        
        if (availableVoices.length === 1) {
          showVoiceNotification(`Only one voice available: ${availableVoices[0].type}`);
          return;
        }

        selectedVoiceIndex = (selectedVoiceIndex + 1) % availableVoices.length;
        const voiceInfo = availableVoices[selectedVoiceIndex];
        console.log(`🎤 Switching to voice: ${voiceInfo.type} (index ${selectedVoiceIndex})`);
        showVoiceNotification(`Voice: ${voiceInfo.type}`);

        // If currently speaking, switch voice immediately
        if (isSpeaking && currentUtterance) {
          try {
            const contentElement = document.getElementById('module-content');
            let textToSpeak = contentElement ? (contentElement.innerText || contentElement.textContent) : '';
            
            // Remove button text
            textToSpeak = textToSpeak.replace(/✓?\s*Mark as Complete/gi, '').replace(/Complete Module/gi, '');
            
            if (!textToSpeak.trim()) {
              showVoiceNotification('No content to read');
              return;
            }
            
            // Cancel current speech
            speechSynthesis.cancel();
            
            // Create new utterance with new voice
            currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
            currentUtterance.rate = 1;
            currentUtterance.pitch = 1;
            currentUtterance.volume = 1;
            currentUtterance.voice = availableVoices[selectedVoiceIndex].voiceObj;

            currentUtterance.onend = () => {
              isSpeaking = false;
              readAloudToggle.style.color = '';
              readAloudToggle.style.opacity = '';
            };

            currentUtterance.onerror = (error) => {
              console.error('Voice change error:', error);
              isSpeaking = false;
              readAloudToggle.style.color = '';
              readAloudToggle.style.opacity = '';
            };

            // Resume speaking with new voice
            setTimeout(() => {
              if (isSpeaking) {
                speechSynthesis.speak(currentUtterance);
                console.log(`🎤 Resumed speech with new voice: ${voiceInfo.type}`);
              }
            }, 50);
          } catch (err) {
            console.error('Error changing voice:', err);
            showVoiceNotification('Error changing voice');
          }
        } else {
          showVoiceNotification(`Ready to use: ${voiceInfo.type}`);
        }
      };

      // Touch event handlers for mobile
      readAloudToggle.addEventListener('touchstart', (e) => {
        console.log('📱 touchstart on read-aloud button');
        isTouchDevice = true;
        longPressTimer = setTimeout(() => {
          console.log('📱 Long press detected (500ms)');
          e.preventDefault();
          changeVoice();
        }, longPressDuration);
      }, { passive: true });

      readAloudToggle.addEventListener('touchend', (e) => {
        console.log('📱 touchend on read-aloud button');
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          // Short tap = toggle read aloud
          console.log('📱 Short tap detected');
          toggleReadAloud();
        }
      }, { passive: true });

      readAloudToggle.addEventListener('touchcancel', () => {
        console.log('📱 touchcancel on read-aloud button');
        if (longPressTimer) {
          clearTimeout(longPressTimer);
        }
      }, { passive: true });

      // Click handler for desktop (ignores touch if isTouchDevice is true)
      readAloudToggle.addEventListener('click', (e) => {
        console.log('🖱️ click on read-aloud button (isTouchDevice: ' + isTouchDevice + ')');
        if (isTouchDevice) {
          isTouchDevice = false;
          return;
        }
        toggleReadAloud();
      });

      // Right-click to change voice (desktop)
      readAloudToggle.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        changeVoice();
      });

      // Add tooltip showing you can right-click to change voice
      readAloudToggle.title = 'Click to read aloud (Right-click to change voice | Long-press on mobile for voice change)';
    }

    // --- Module content search (OR behavior) ---
    const searchToggle = document.getElementById('module-search-toggle');
    const searchContainer = document.getElementById('module-search-container');
    const searchInput = document.getElementById('module-search-input');
    const searchResult = document.getElementById('module-search-result');

    function clearHighlights(root) {
      const marks = root.querySelectorAll('mark.module-match');
      marks.forEach(mark => {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize && parent.normalize();
      });
    }

    function highlightMatches(root, tokens) {
      if (!tokens.length) return 0;
      let count = 0;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      tokens.forEach(token => {
        if (!token) return;
        const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
        textNodes.forEach(node => {
          const parent = node.parentNode;
          if (!parent) return;
          // Skip inside certain elements
          if (parent.closest && parent.closest('script,style,mark')) return;
          const txt = node.nodeValue;
          if (!txt) return;
          if (re.test(txt)) {
            count++;
            const frag = document.createDocumentFragment();
            let lastIndex = 0;
            re.lastIndex = 0;
            let m;
            // Reset regex to iterate
            while ((m = re.exec(txt)) !== null) {
              const before = txt.slice(lastIndex, m.index);
              if (before) frag.appendChild(document.createTextNode(before));
              const mark = document.createElement('mark');
              mark.className = 'module-match';
              mark.textContent = m[0];
              frag.appendChild(mark);
              lastIndex = re.lastIndex;
            }
            const tail = txt.slice(lastIndex);
            if (tail) frag.appendChild(document.createTextNode(tail));
            parent.replaceChild(frag, node);
          }
        });
      });

      return count;
    }

    if (searchToggle) {
      searchToggle.addEventListener('click', () => {
        if (!searchContainer) return;
        const visible = searchContainer.style.display !== 'none';
        if (visible) {
          searchContainer.style.display = 'none';
          if (searchInput) searchInput.value = '';
          if (searchResult) searchResult.textContent = '';
          clearHighlights(container);
        } else {
          searchContainer.style.display = 'block';
          if (searchInput) searchInput.focus();
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = (searchInput.value || '').trim().toLowerCase();
        clearHighlights(container);
        if (!q) {
          if (searchResult) searchResult.textContent = '';
          return;
        }
        const tokens = q.split(/\W+/).filter(Boolean);
        const count = highlightMatches(container, tokens);
        if (searchResult) searchResult.textContent = count > 0 ? `${count} match${count>1? 'es':''} found` : 'No matches found';

        // Reveal and scroll to first match (expand containing section if necessary)
        if (count > 0) {
          const firstMark = container.querySelector('mark.module-match');
          if (firstMark) {
            const section = firstMark.closest('.lesson-section');
            if (section) {
              const body = section.querySelector('.section-body');
              const header = section.querySelector('.section-header');
              if (body && header) {
                body.classList.add('open');
                header.classList.add('active');
                // persist open state
                const sections = Array.from(container.querySelectorAll('.lesson-section'));
                const index = sections.indexOf(section);
                localStorage.setItem(`module-${courseId}-${moduleId}-section-${index}-open`, 'yes');
              }
            }
            try {
              firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (e) {
              // fallback
              const y = firstMark.getBoundingClientRect().top + window.scrollY - 120;
              window.scrollTo({ top: y, behavior: 'smooth' });
            }
          }
        }
      });
    }

    // Delegated expand/collapse handler - ONLY for h3 headers, NOT h1 (section headers)
    container.addEventListener('click', (e) => {
      // Don't make h1 sections clickable/collapsible - section headers should always be visible
      const header = e.target.closest('.section-header');
      if (header) return; // Skip h1 section headers entirely
      
      // Handle h3 headers if needed (currently not used but kept for future)
      const h3Header = e.target.closest('h3.collapsible');
      if (!h3Header || !container.contains(h3Header)) return;
      const body = h3Header.nextElementSibling;
      if (!body || !body.classList.contains('section-body')) return;
      const section = h3Header.closest('.lesson-section');

      const sections = Array.from(container.querySelectorAll('.lesson-section'));
      const index = sections.indexOf(section);
      const openKey = `module-${courseId}-${moduleId}-section-${index}-open`;

      const isNowOpen = body.classList.toggle('open');
      h3Header.classList.toggle('active', isNowOpen);
      localStorage.setItem(openKey, isNowOpen ? 'yes' : 'no');
    });

    // ===== PROGRESS TRACKING =====
    function updateProgress() {
      const sections = container.querySelectorAll(".lesson-section");

      if (!sections.length || !progressFill || !progressText) return;

      let completed = 0;
      sections.forEach(section => {
        if (section.classList.contains("completed")) {
          completed++;
        }
      });

      const percent = Math.round((completed / sections.length) * 100);

      // Update progress bar and text
      progressFill.style.width = percent + "%";
      progressText.textContent = percent + "% completed";

      // Save progress overall - include user email to isolate per user
      const userEmail = JSON.parse(localStorage.getItem('currentUser') || '{}').email || 'guest';
      const lessonKey = `module-progress-${courseId}-${moduleId}-${userEmail}`;
      localStorage.setItem(lessonKey, percent);

      // Unlock quiz if all sections are completed
      if (percent === 100) {
        quizLock.style.display = "none";
        startQuizBtn.disabled = false;
        startQuizBtn.removeAttribute("locked");
      } else {
        quizLock.style.display = "block";
        startQuizBtn.disabled = true;
        startQuizBtn.setAttribute("locked", "");
      }
    }

    // Call initial progress update
    updateProgress();

    // Handle mark as complete button clicks
    container.addEventListener('click', (e) => {
      if (!e.target.classList.contains('mark-complete-btn')) return;

      const section = e.target.closest('.lesson-section');
      if (!section) return;

      const btn = e.target;
      const sections = Array.from(container.querySelectorAll('.lesson-section'));
      const sectionIndex = sections.indexOf(section);
      const userEmail = JSON.parse(localStorage.getItem('currentUser') || '{}').email || 'guest';
      const completeKey = `module-${courseId}-${moduleId}-section-${sectionIndex}-completed-${userEmail}`;

      const isCompleted = section.classList.toggle('completed');

      if (isCompleted) {
        btn.textContent = '✓ Section Complete';
        btn.style.background = '#6b7280';
        btn.disabled = true;
        localStorage.setItem(completeKey, 'yes');
      } else {
        btn.textContent = '✓ Mark as Complete';
        btn.style.background = '#10b981';
        btn.disabled = false;
        localStorage.removeItem(completeKey);
      }

      updateProgress();
    });

    // Restore section completed state and open all sections by default
    const sections = Array.from(container.querySelectorAll('.lesson-section'));
    const userEmail = JSON.parse(localStorage.getItem('currentUser') || '{}').email || 'guest';
    sections.forEach((section, index) => {
      const h3 = section.querySelector('.section-header');
      const body = section.querySelector('.section-body');
      const completeBtn = section.querySelector('.mark-complete-btn');
      if (!body || !h3) return;

      // Open all sections by default
      body.classList.add('open');
      h3.classList.add('active');

      // Completed state
      const completeKey = `module-${courseId}-${moduleId}-section-${index}-completed-${userEmail}`;
      const isCompleted = localStorage.getItem(completeKey) === 'yes';
      if (isCompleted) {
        section.classList.add('completed');
        if (completeBtn) {
          completeBtn.textContent = '✓ Section Complete';
          completeBtn.style.background = '#6b7280';
          completeBtn.disabled = true;
        }
      }
    });

    // Restore progress from localStorage
    const lessonKey = `module-progress-${courseId}-${moduleId}-${userEmail}`;
    const savedProgress = localStorage.getItem(lessonKey);
    if (savedProgress) {
      progressFill.style.width = savedProgress + "%";
      progressText.textContent = savedProgress + "% completed";
    }

    // Initial progress update
    updateProgress();

    // ===== QUIZ SYSTEM =====
    // Load quiz data from module metadata if available
    let quizData = [];
    if (module.quiz) {
      if (Array.isArray(module.quiz)) quizData = module.quiz;
      else if (typeof module.quiz === 'string') {
        try { const rq = await fetch(`/data/modules/${encodeURIComponent(courseId)}/${encodeURIComponent(module.quiz)}`); if (rq.ok) quizData = await rq.json(); } catch(e) { quizData = []; }
      }
    }

    // Load projects data for rendering
    let projectsData = [];
    if (module.projects) {
      if (Array.isArray(module.projects)) projectsData = module.projects;
      else if (typeof module.projects === 'string') {
        try { const rp = await fetch(`/data/modules/${encodeURIComponent(courseId)}/${encodeURIComponent(module.projects)}`); if (rp.ok) projectsData = await rp.json(); } catch(e) { projectsData = []; }
      }
    }

    // Render projects area
    const projectWrap = document.getElementById('project-content');
    if (projectWrap) {
      projectWrap.innerHTML = '';
      if (projectsData && projectsData.length>0) {
        projectsData.forEach(p => {
          const el = document.createElement('div'); el.className='project-item';
          const t = document.createElement('h4'); t.textContent = p.title || 'Project';
          const d = document.createElement('p'); d.textContent = p.description || '';
          el.appendChild(t); el.appendChild(d); projectWrap.appendChild(el);
        });
      } else {
        projectWrap.innerHTML = '<div style="color:var(--text-muted)">No projects available.</div>';
      }
    }

    if (startQuizBtn && quizContent) {
      startQuizBtn.addEventListener("click", () => {
        if (startQuizBtn.disabled) return;

        quizContent.innerHTML = "";

        // Render questions
        quizData.forEach((item, index) => {
          const questionDiv = document.createElement("div");
          questionDiv.classList.add("quiz-question");
          questionDiv.style.marginBottom = "15px";

          const questionTitle = document.createElement("h4");
          questionTitle.textContent = `${index + 1}. ${item.question}`;
          questionDiv.appendChild(questionTitle);

          item.options.forEach((opt, i) => {
            const label = document.createElement("label");
            label.style.display = "block";
            label.style.marginLeft = "15px";
            label.style.marginBottom = "5px";
            label.style.cursor = "pointer";

            const input = document.createElement("input");
            input.type = "radio";
            input.name = `quiz-${index}`;
            input.value = i;

            label.appendChild(input);
            label.append(` ${opt}`);
            questionDiv.appendChild(label);
          });

          quizContent.appendChild(questionDiv);
        });

        // Check Answers button
        const checkBtn = document.createElement("button");
        checkBtn.id = "check-quiz";
        checkBtn.textContent = "Check Answers";
        checkBtn.style.marginTop = "10px";
        checkBtn.style.padding = "8px 12px";
        checkBtn.style.cursor = "pointer";

        // Try Again button
        const tryAgainBtn = document.createElement("button");
        tryAgainBtn.id = "try-again";
        tryAgainBtn.textContent = "Try Again";
        tryAgainBtn.style.marginTop = "10px";
        tryAgainBtn.style.marginLeft = "10px";
        tryAgainBtn.style.padding = "8px 12px";
        tryAgainBtn.style.cursor = "pointer";

        const resultDiv = document.createElement("div");
        resultDiv.id = "quiz-result";
        resultDiv.style.marginTop = "10px";
        resultDiv.style.fontWeight = "bold";

        quizContent.appendChild(checkBtn);
        quizContent.appendChild(tryAgainBtn);
        quizContent.appendChild(resultDiv);

        // Check answers logic
        checkBtn.addEventListener("click", () => {
          resultDiv.textContent = "Calculating score...";

          setTimeout(() => {
            let score = 0;

            quizData.forEach((item, index) => {
              const selected = document.querySelector(`input[name="quiz-${index}"]:checked`);
              const options = document.querySelectorAll(`input[name="quiz-${index}"]`);

              options.forEach((input, i) => {
                const label = input.parentElement;
                label.style.color = "inherit";
                label.style.fontWeight = "normal";

                if (i === item.answer) {
                  label.style.color = "green";
                  label.style.fontWeight = "bold";
                }
              });

              if (selected) {
                if (Number(selected.value) === item.answer) {
                  score++;
                } else {
                  selected.parentElement.style.color = "red";
                }
              }
            });

            const percent = Math.round((score / quizData.length) * 100);
            let grade = "", comment = "", commentColor = "";

            if (percent === 100) {
              grade = "A+";
              comment = "Excellent! Perfect score!";
              commentColor = "gold";
            } else if (percent >= 75) {
              grade = "A";
              comment = "Very good job!";
              commentColor = "limegreen";
            } else if (percent >= 60) {
              grade = "B";
              comment = "Good effort!";
              commentColor = "deepskyblue";
            } else if (percent >= 50) {
              grade = "C";
              comment = "Not bad, keep practicing.";
              commentColor = "orange";
            } else {
              grade = "F";
              comment = "Keep studying and try again!";
              commentColor = "red";
            }

            resultDiv.innerHTML = `
              <p style="color: ${commentColor}; font-size: 18px;">
                ${comment}<br>
                Score: ${score}/${quizData.length} (${percent}%)<br>
                Grade: <span style="font-size: 24px;">${grade}</span>
              </p>
            `;

            // Log quiz completion to attendance system
            if (getToken() && moduleId && courseId) {
              logQuizCompletion(moduleId, courseId, score, quizData.length, percent >= 60).catch(err => {
                console.warn('Failed to log quiz completion:', err);
              });

              // Award points for quiz attempt and pass
              const action = percent >= 60 ? 'quiz_pass' : 'quiz_attempt';
              awardPoints(action, { moduleId, courseId, score, totalQuestions: quizData.length }).catch(err => {
                console.warn('Failed to award points:', err);
              });

              // Send notification for quiz pass
              if (percent >= 70 && typeof notificationTriggers !== 'undefined') {
                notificationTriggers.checkQuizPassed(courseId, percent).catch(err => {
                  console.warn('Failed to create quiz pass notification:', err);
                });
              }
            }

            checkBtn.disabled = true;
          }, 500);
        });

        // Try Again button
        tryAgainBtn.addEventListener("click", () => {
          quizContent.innerHTML = "";
          startQuizBtn.click();
        });
      });
    }

    // Render comments section
    const commentsSection = document.getElementById('module-comments');
    if (commentsSection) {
      // Check if we need to highlight a specific comment (from mention notification)
      const highlightCommentId = new URLSearchParams(window.location.search).get('highlightComment');
      console.log('🔍 Module page - highlightCommentId from URL:', highlightCommentId);
      await renderComments(commentsSection, moduleId, courseId, highlightCommentId);
      
      // Auto-scroll to comments if hash is #comments or if there's a highlight param
      if (window.location.hash === '#comments' || highlightCommentId) {
        console.log('⏳ Scheduling autoscroll with 800ms delay...');
        setTimeout(() => {
          console.log('🔄 Auto-scrolling to comments section');
          commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 800);
      }
    }

    // Toggle resources visibility
    const resourcesToggle = document.getElementById('resources-toggle');
    const resourcesSection = document.getElementById('module-resources');
    if (resourcesToggle && resourcesSection) {
      resourcesToggle.addEventListener('click', () => {
        const isHidden = resourcesSection.style.display === 'none';
        resourcesSection.style.display = isHidden ? 'block' : 'none';
        resourcesToggle.textContent = isHidden ? '▲ Hide Resources' : '▼ Show Resources';
      });
    }

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Error loading module content.</p>";
  }

  // --- Admin unlock button behavior ---
  const adminBtn = document.getElementById('admin-unlock-btn');
  if (adminBtn) {
    adminBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      // simple modal with input
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed'; overlay.style.left = 0; overlay.style.top = 0; overlay.style.right = 0; overlay.style.bottom = 0;
      overlay.style.background = 'rgba(0,0,0,0.45)'; overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; overlay.style.zIndex = 99999;
      const box = document.createElement('div'); box.style.background = '#fff'; box.style.padding = '18px'; box.style.borderRadius = '10px'; box.style.width = '360px'; box.style.maxWidth = '92%'; box.style.boxShadow = '0 12px 40px rgba(2,6,23,0.25)';
      box.innerHTML = `<h3 style="margin:0 0 10px 0">Admin Unlock</h3><p style="margin:0 0 12px 0;color:#666;font-size:14px">Enter admin ID number to unlock premium modules on this device.</p>`;
      const input = document.createElement('input'); input.type = 'text'; input.placeholder = 'Admin ID number'; input.style.width = '100%'; input.style.padding = '10px'; input.style.marginBottom = '12px'; input.style.border = '1px solid #e6e9ef'; input.style.borderRadius = '6px';
      const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'flex-end'; row.style.gap = '8px';
      const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.style.padding = '8px 12px'; cancel.style.border = 'none'; cancel.style.background = '#e5e7eb'; cancel.style.borderRadius = '6px';
      const ok = document.createElement('button'); ok.textContent = 'OK'; ok.style.padding = '8px 12px'; ok.style.border = 'none'; ok.style.background = '#0b6fb7'; ok.style.color = '#fff'; ok.style.borderRadius = '6px';
      row.appendChild(cancel); row.appendChild(ok);
      box.appendChild(input); box.appendChild(row);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      input.focus();

      const cleanup = () => { try { overlay.remove(); } catch(e){} };

      cancel.addEventListener('click', () => { cleanup(); });
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) cleanup(); });

      ok.addEventListener('click', async () => {
        const val = (input.value || '').trim();
        if (!val) { await showAlert('Missing ID', 'Please enter an admin ID number.', 'warning'); return; }
        try {
          // fetch admins list (file is server/admins.json served statically)
          const res = await fetch('/server/admins.json');
          if (!res.ok) { await showAlert('Error', 'Unable to verify admin ID at this time.', 'error'); cleanup(); return; }
          const list = await res.json();
          const match = (list || []).find(a => (a.idNumber||'').trim() === val);
          if (match) {
            localStorage.setItem('adminUnlocked', 'true');
            await showAlert('Unlocked', 'Premium modules unlocked for this browser session.', 'success');
            cleanup();
            // reload to apply unlocked state
            window.location.reload();
          } else {
            await showAlert('Invalid ID', 'The ID number entered was not recognized.', 'error');
          }
        } catch (e) {
          console.error('Admin verify error', e);
          await showAlert('Error', 'Failed to verify admin ID.', 'error');
          cleanup();
        }
      });
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ok.click(); });
    });
  }

  // Log module view on page unload
  window.addEventListener('beforeunload', () => {
    if (moduleId && courseId && getToken()) {
      const duration = Math.round((Date.now() - moduleStartTime) / 1000);
      // Use fetch with keepalive for reliable logging on page exit
      fetch('/api/attendance/log-view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          moduleId,
          courseId,
          duration
        }),
        keepalive: true
      }).catch(err => console.warn('Failed to log module view:', err));
    }
  });
});

/**
 * Initialize highlighting system
 */
async function initializeHighlighting(contentContainer, contentId, contentType = 'module') {
  if (!contentContainer || !getToken()) return;

  // Create toolbar
  highlightToolbar = new HighlightToolbar(
    handleColorSelect,
    handleDeleteHighlight
  );

  // Load existing highlights from server
  const serverHighlights = await fetchHighlights(contentId, contentType);
  
  // Reapply highlights to the DOM
  if (serverHighlights.length > 0) {
    reapplyHighlights(contentContainer, serverHighlights);
    
    // Store highlight refs
    serverHighlights.forEach(h => {
      const span = contentContainer.querySelector(`[data-highlight-id="${h.id}"]`);
      if (span) {
        highlightedSpans.set(h.id, { spanElement: span, serverId: h.id });
      }
    });
  }

  // Set up selection listeners
  setupSelectionListeners(contentContainer, contentId, contentType);

  // Set up existing highlight click handlers
  setupExistingHighlightHandlers(contentContainer);
}

/**
 * Set up text selection detection
 */
function setupSelectionListeners(contentContainer, contentId, contentType) {
  // Listen for selection changes and mouse/touch events
  document.addEventListener('selectionchange', () => {
    handleSelectionChanged(contentContainer, contentId, contentType);
  });

  contentContainer.addEventListener('mouseup', () => {
    handleSelectionChanged(contentContainer, contentId, contentType);
  });

  contentContainer.addEventListener('touchend', () => {
    setTimeout(() => {
      handleSelectionChanged(contentContainer, contentId, contentType);
    }, 50);
  });
}

/**
 * Handle text selection
 */
function handleSelectionChanged(contentContainer, contentId, contentType) {
  const selection = getTextSelection(contentContainer);

  if (!selection || selection.text.length === 0) {
    // Hide toolbar if no valid selection
    if (highlightToolbar) {
      highlightToolbar.hide();
    }
    return;
  }

  // Position toolbar above selection
  const range = window.getSelection().getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  const toolbarX = rect.left + (rect.width / 2) - 80; // Approximate center
  const toolbarY = Math.max(10, rect.top - 60); // Above selection

  // Store current selection for toolbar actions
  window.currentTextSelection = {
    text: selection.text,
    startOffset: selection.startOffset,
    endOffset: selection.endOffset,
    contentId,
    contentType
  };

  if (highlightToolbar) {
    highlightToolbar.show(toolbarX, toolbarY);
  }
}

/**
 * Handle color selection from toolbar
 */
async function handleColorSelect(color, colorName) {
  if (!window.currentTextSelection) return;

  const { text, startOffset, endOffset, contentId, contentType } = window.currentTextSelection;

  // Generate temporary ID
  const tempId = 'temp-' + Math.random().toString(36).substr(2, 9);

  // Get the actual DOM node to wrap
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  
  // Create span with highlight
  const span = document.createElement('span');
  span.className = 'text-highlight';
  span.dataset.highlightId = tempId;
  span.style.backgroundColor = color;
  
  try {
    range.surroundContents(span);
  } catch (e) {
    // If surroundContents fails (e.g., crossing multiple nodes), use extractContents
    const contents = range.extractContents();
    span.appendChild(contents);
    range.insertNode(span);
  }

  // Store in local map
  highlightedSpans.set(tempId, { spanElement: span, serverId: null });
  pendingHighlights.push({ tempId, span });

  // Clear selection
  window.getSelection().removeAllRanges();

  // Save to server in background
  const highlight = {
    tempId,
    contentId,
    contentType,
    text,
    startOffset,
    endOffset,
    color,
    parentSelector: 'module-content'
  };

  try {
    const serverHighlight = await saveHighlight(highlight);
    
    if (serverHighlight && serverHighlight.id) {
      // Replace temp ID with server ID
      span.dataset.highlightId = serverHighlight.id;
      highlightedSpans.delete(tempId);
      highlightedSpans.set(serverHighlight.id, { spanElement: span, serverId: serverHighlight.id });
      pendingHighlights = pendingHighlights.filter(h => h.tempId !== tempId);

      // Re-setup click handler for this highlight
      setupSingleHighlightHandler(span, serverHighlight.id, contentId, contentType);
    }
  } catch (err) {
    console.error('Error saving highlight:', err);
    // Remove highlight from DOM on error
    removeHighlightFromDOM(span);
    highlightedSpans.delete(tempId);
  }
}

/**
 * Handle delete highlight request
 */
async function handleDeleteHighlight() {
  if (!window.currentHighlightElement) return;

  const span = window.currentHighlightElement;
  const highlightId = span.dataset.highlightId;

  // Remove from DOM immediately
  removeHighlightFromDOM(span);
  highlightedSpans.delete(highlightId);

  // Delete from server
  try {
    await deleteHighlight(highlightId);
  } catch (err) {
    console.error('Error deleting highlight:', err);
  }
}

/**
 * Set up click handlers for existing highlights
 */
function setupExistingHighlightHandlers(contentContainer) {
  const highlights = findHighlightSpans(contentContainer);
  highlights.forEach(span => {
    const highlightId = span.dataset.highlightId;
    if (highlightId) {
      setupSingleHighlightHandler(span, highlightId, moduleId, 'module');
    }
  });
}

/**
 * Set up single highlight click handler
 */
function setupSingleHighlightHandler(span, highlightId, contentId, contentType) {
  span.addEventListener('click', (e) => {
    e.stopPropagation();

    // Store reference for toolbar action
    window.currentHighlightElement = span;
    window.currentHighlightId = highlightId;

    // Get position to show toolbar
    const rect = span.getBoundingClientRect();
    const toolbarX = rect.left + (rect.width / 2) - 80;
    const toolbarY = Math.max(10, rect.top - 60);

    // Store color info for potential update
    window.currentHighlightColor = span.style.backgroundColor;

    // Show toolbar with update handler
    if (highlightToolbar) {
      // Replace color handler with update handler
      highlightToolbar.onColorSelect = (newColor, colorName) => {
        handleUpdateHighlightColor(span, highlightId, newColor, contentId, contentType);
      };
      highlightToolbar.show(toolbarX, toolbarY);
    }
  });
}

/**
 * Handle highlight color update
 */
async function handleUpdateHighlightColor(span, highlightId, newColor, contentId, contentType) {
  // Update DOM immediately
  span.style.backgroundColor = newColor;

  // Update on server
  try {
    await updateHighlight(highlightId, newColor);
  } catch (err) {
    console.error('Error updating highlight:', err);
    // Revert on error
    span.style.backgroundColor = window.currentHighlightColor;
  }

  // Reset color handler
  highlightToolbar.onColorSelect = handleColorSelect;
}
