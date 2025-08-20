// Company Onboarding JavaScript
class CompanyOnboarding {
    constructor() {
        this.currentStep = 'overview';
        this.sessionId = this.generateSessionId();
        this.progress = this.loadProgress();
        this.selectedBasicChallenges = [];
        this.selectedPackages = [];
        this.availableChallenges = [];
        this.currentChallengeIndex = 0;
        this.currentChallenge = null;
        this.setupStep = 1;
        this.autoSaveTimer = null;
        this.lastSaveTime = 0;
        this.init();
    }

    generateSessionId() {
        // Generate or retrieve session ID for this onboarding session
        let sessionId = localStorage.getItem('company-onboarding-session-id');
        if (!sessionId) {
            sessionId = 'onboarding_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('company-onboarding-session-id', sessionId);
        }
        return sessionId;
    }

    getStorageKey(key) {
        return `${this.sessionId}_${key}`;
    }

    init() {
        this.setupEventListeners();
        this.loadChallenges();
        this.updateProgress();
        this.updateNavigation();
        this.checkExistingProgress();
    }

    setupEventListeners() {
        // Navigation listeners
        document.querySelectorAll('#onboarding-nav a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const step = e.currentTarget.dataset.step;
                this.showSection(step);
            });
        });

        // Setup modal listeners
        this.setupModalListeners();
        this.setupEditorListeners();
        this.setupAIListeners();
    }

    setupModalListeners() {
        const nextBtn = document.getElementById('setup-next-btn');
        const backBtn = document.getElementById('setup-back-btn');
        const startBtn = document.getElementById('setup-start-btn');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextSetupStep());
        }
        if (backBtn) {
            backBtn.addEventListener('click', () => this.prevSetupStep());
        }
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startLearningSession());
        }

        // Modal open event - load challenges when modal opens
        const setupModal = document.getElementById('setupModal');
        if (setupModal) {
            setupModal.addEventListener('shown.bs.modal', () => {
                this.populateModalChallengesList();
            });
        }

        // Package and challenge selection
        document.addEventListener('change', (e) => {
            if (e.target.matches('#packages-list input[type="checkbox"]')) {
                this.updatePackageSelection();
            }
            if (e.target.matches('#basic-challenges-list input[type="checkbox"]')) {
                this.updateBasicChallengeSelection();
            }
        });
    }

    setupEditorListeners() {
        // Editor buttons
        const runBtn = document.getElementById('run-button');
        const submitBtn = document.getElementById('submit-button');
        const prevBtn = document.getElementById('prev-challenge');
        const nextBtn = document.getElementById('next-challenge');
        
        if (runBtn) runBtn.addEventListener('click', () => this.runTests());
        if (submitBtn) submitBtn.addEventListener('click', () => this.submitSolution());
        if (prevBtn) prevBtn.addEventListener('click', () => this.previousChallenge());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextChallenge());

        // Session controls
        const saveExitBtn = document.getElementById('save-and-exit');
        const resetBtn = document.getElementById('reset-progress');
        
        if (saveExitBtn) saveExitBtn.addEventListener('click', () => this.saveAndExit());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetProgress());
    }

    setupAIListeners() {
        // AI assistance functions
        window.requestAIReview = () => this.requestAIReview();
        window.requestInterviewQuestions = () => this.requestInterviewQuestions();
        window.requestHint = (level) => this.requestHint(level);
    }

    async loadChallenges() {
        try {
            const response = await fetch('/api/challenges');
            
            if (!response.ok) {
                console.error('Failed to fetch challenges:', response.status);
                return false;
            }
            
            const challenges = await response.json();
            
            if (Array.isArray(challenges) && challenges.length > 0) {
                this.availableChallenges = challenges;
                this.populateBasicChallengesList();
                return true;
            } else {
                console.error('No challenges data received:', challenges);
                return false;
            }
        } catch (error) {
            console.error('Error loading challenges:', error);
            return false;
        }
    }

    populateBasicChallengesList() {
        const container = document.getElementById('basic-challenges-list');
        if (!container) return;

        const basicChallenges = this.availableChallenges
            .filter(c => c.difficulty === 'Beginner' || c.difficulty === 'Intermediate')
            .slice(0, 10);

        container.innerHTML = basicChallenges.map(challenge => `
            <div class="list-group-item">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${challenge.id}" id="basic-${challenge.id}">
                    <label class="form-check-label w-100" for="basic-${challenge.id}">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>Challenge ${challenge.id}: ${challenge.title}</strong>
                                <div class="small text-muted">${challenge.description}</div>
                            </div>
                            <span class="badge bg-${this.getDifficultyClass(challenge.difficulty)}">${challenge.difficulty}</span>
                        </div>
                    </label>
                </div>
            </div>
        `).join('');
    }

    populateModalChallengesList() {
        // This method populates the modal challenges list
        if (this.availableChallenges.length === 0) {
            // If challenges haven't loaded yet, try to load them
            this.loadChallenges().then((success) => {
                if (success) {
                    this.populateModalChallengesContent();
                } else {
                    console.error('Failed to load challenges from API');
                }
            });
        } else {
            this.populateModalChallengesContent();
        }
    }

    populateModalChallengesContent() {
        const container = document.getElementById('basic-challenges-list');
        if (!container) return;

        // Get all challenges for basics (all difficulty levels like interview page)
        this.allBasicChallenges = this.availableChallenges
            .sort((a, b) => a.id - b.id); // Sort by ID

        if (this.allBasicChallenges.length === 0) {
            container.innerHTML = `
                <div class="list-group-item text-center">
                    <div class="spinner-border text-primary mb-2" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="text-muted mb-0">Loading challenges...</p>
                </div>
            `;
            return;
        }

        // Set up filtering
        this.activeFilter = 'all';
        this.setupFiltering();
        this.applyFiltersAndRender();
    }

    setupFiltering() {
        // Setup search input
        const searchInput = document.getElementById('basic-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyFiltersAndRender());
        }

        // Setup filter buttons
        const filterButtons = document.querySelectorAll('#setup-step-1 .btn-group button[data-filter]');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Update active filter button
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilter = btn.getAttribute('data-filter').toLowerCase();
                this.applyFiltersAndRender();
            });
        });
    }

    filteredBasicChallenges() {
        const searchInput = document.getElementById('basic-search');
        const term = (searchInput?.value || '').toLowerCase().trim();
        const normalizedTerm = term.replace(/\s+/g, '');
        
        return this.allBasicChallenges.filter(ch => {
            // Filter by difficulty
            const matchesDiff = (this.activeFilter === 'all') || 
                               (ch.difficulty.toLowerCase() === this.activeFilter);
            
            // Filter by search term (match interview page format)
            const text = (`#${ch.id} ${ch.title}`).toLowerCase();
            const normalizedText = text.replace(/\s+/g, '');
            const matchesTerm = !term || 
                               text.includes(term) || 
                               normalizedText.includes(normalizedTerm);
            
            return matchesDiff && matchesTerm;
        }).sort((a, b) => a.id - b.id); // Keep sorted by ID
    }

    applyFiltersAndRender() {
        const container = document.getElementById('basic-challenges-list');
        if (!container) return;

        const challenges = this.filteredBasicChallenges();
        
        if (challenges.length === 0) {
            container.innerHTML = `
                <div class="list-group-item text-center">
                    <p class="text-muted mb-0">No challenges match your search criteria.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = challenges.map(challenge => {
            const difficultyIcon = challenge.difficulty === 'Beginner' ? 'bi-circle' : 
                                 challenge.difficulty === 'Intermediate' ? 'bi-triangle' : 'bi-diamond';
            return `
            <div class="list-group-item">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${challenge.id}" id="modal-basic-${challenge.id}">
                    <label class="form-check-label w-100" for="modal-basic-${challenge.id}">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-semibold text-primary">#${challenge.id} - ${challenge.title}</div>
                            </div>
                            <span class="badge ${this.getDifficultyBadgeClass(challenge.difficulty)} px-2 py-1">
                                <i class="${difficultyIcon} me-1"></i>${challenge.difficulty}
                            </span>
                        </div>
                    </label>
                </div>
            </div>
            `;
        }).join('');
    }

    getDifficultyClass(difficulty) {
        switch(difficulty?.toLowerCase()) {
            case 'beginner': return 'success';
            case 'intermediate': return 'warning';
            case 'advanced': return 'danger';
            default: return 'secondary';
        }
    }

    getDifficultyBadgeClass(difficulty) {
        switch(difficulty?.toLowerCase()) {
            case 'beginner': return 'bg-success';
            case 'intermediate': return 'bg-warning';
            case 'advanced': return 'bg-danger';
            default: return 'bg-secondary';
        }
    }

    updateBasicChallengeSelection() {
        const checkboxes = document.querySelectorAll('#basic-challenges-list input[type="checkbox"]:checked');
        this.selectedBasicChallenges = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        const countElement = document.getElementById('basic-selected-count');
        if (countElement) {
            countElement.textContent = this.selectedBasicChallenges.length;
        }
        
        const nextBtn = document.getElementById('setup-next-btn');
        if (nextBtn) {
            nextBtn.disabled = this.selectedBasicChallenges.length === 0;
        }
    }

    updatePackageSelection() {
        const checkboxes = document.querySelectorAll('#packages-list input[type="checkbox"]:checked');
        this.selectedPackages = Array.from(checkboxes).map(cb => cb.value);
        
        document.getElementById('packages-selected-count').textContent = this.selectedPackages.length;
        document.getElementById('setup-start-btn').style.display = this.selectedPackages.length > 0 ? 'inline-block' : 'none';
    }

    nextSetupStep() {
        if (this.setupStep === 1) {
            document.getElementById('setup-step-1').style.display = 'none';
            document.getElementById('setup-step-2').style.display = 'block';
            document.getElementById('setup-back-btn').style.display = 'inline-block';
            document.getElementById('setup-next-btn').style.display = 'none';
            document.getElementById('setup-start-btn').style.display = 'inline-block';
            this.setupStep = 2;
        }
    }

    prevSetupStep() {
        if (this.setupStep === 2) {
            document.getElementById('setup-step-1').style.display = 'block';
            document.getElementById('setup-step-2').style.display = 'none';
            document.getElementById('setup-back-btn').style.display = 'none';
            document.getElementById('setup-next-btn').style.display = 'inline-block';
            document.getElementById('setup-start-btn').style.display = 'none';
            this.setupStep = 1;
        }
    }

    startLearningSession() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('setupModal'));
        if (modal) modal.hide();

        this.prepareLearningPlan();
        document.getElementById('onboarding-overview').style.display = 'none';
        document.getElementById('onboarding-session').style.display = 'block';
        this.loadCurrentChallenge();
        this.updateSessionMeta();
    }

    prepareLearningPlan() {
        this.learningPlan = {
            basicChallenges: this.selectedBasicChallenges,
            packages: this.selectedPackages,
            totalChallenges: this.selectedBasicChallenges.length + (this.selectedPackages.length * 2)
        };
        
        this.progress.learningPlan = this.learningPlan;
        this.saveProgress();
    }

    async loadCurrentChallenge() {
        if (this.currentChallengeIndex < this.selectedBasicChallenges.length) {
            const challengeId = this.selectedBasicChallenges[this.currentChallengeIndex];
            await this.loadChallenge(challengeId);
        } else {
            const packageIndex = this.currentChallengeIndex - this.selectedBasicChallenges.length;
            const packageName = this.selectedPackages[Math.floor(packageIndex / 2)];
            const challengeNumber = (packageIndex % 2) + 1;
            await this.loadPackageChallenge(packageName, challengeNumber);
        }
    }

    async fetchChallenge(id) {
        try {
            const response = await fetch(`/api/challenges/${id}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch challenge ${id}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching challenge:', error);
            throw error;
        }
    }

    async loadChallenge(challengeId) {
        try {
            const challenge = await this.fetchChallenge(challengeId);
            this.currentChallenge = challenge;
            this.displayChallenge();
            this.initializeEditor();
        } catch (error) {
            console.error('Error loading challenge:', error);
            this.showToast('Error', `Failed to load challenge ${challengeId}`, 'error');
        }
    }

    async loadPackageChallenge(packageName, challengeNumber) {
        try {
            // Get the proper challenge name based on package learning path
            const challengeNameMap = {
                'gin': [
                    'challenge-1-basic-routing',
                    'challenge-2-middleware', 
                    'challenge-3-validation-errors',
                    'challenge-4-authentication'
                ],
                'gorm': [
                    'challenge-1-crud-operations',
                    'challenge-2-associations',
                    'challenge-3-migrations',
                    'challenge-4-advanced-queries',
                    'challenge-5-generics'
                ],
                'cobra': [
                    'challenge-1-basic-cli',
                    'challenge-2-flags-args',
                    'challenge-3-subcommands-persistence',
                    'challenge-4-advanced-features'
                ],
                'fiber': [
                    'challenge-1-basic-routing',
                    'challenge-2-middleware',
                    'challenge-3-validation-errors',
                    'challenge-4-authentication'
                ]
            };

            const challengeList = challengeNameMap[packageName] || [];
            const challengeId = challengeList[challengeNumber - 1]; // challengeNumber is 1-based
            
            if (!challengeId) {
                throw new Error(`Challenge ${challengeNumber} not found for package ${packageName}`);
            }
            
            console.log(`Loading package challenge: ${packageName}/${challengeId}`);
            
            // Fetch challenge data from API
            const response = await fetch(`/api/packages/${packageName}/${challengeId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch package challenge: ${response.status}`);
            }
            
            const data = await response.json();
            if (!data.success) {
                throw new Error('Failed to load package challenge data');
            }
            
            // Map the API response to our challenge format
            const challenge = data.challenge;
            this.currentChallenge = {
                id: challenge.id,
                title: challenge.title,
                description: challenge.description,
                template: challenge.template,
                testFile: challenge.testFile,
                hints: challenge.hints || '',
                learningMaterials: challenge.learningMaterials || '',
                difficulty: challenge.difficulty,
                isPackageChallenge: true,
                packageName: packageName,
                challengeNumber: challengeNumber,
                actualChallengeId: challengeId
            };
            
                this.displayChallenge();
                this.initializeEditor();
            
        } catch (error) {
            console.error('Error loading package challenge:', error);
            this.showToast('Error', `Failed to load ${packageName} challenge: ${error.message}`, 'error');
        }
    }

    displayChallenge() {
        if (!this.currentChallenge) return;

        // Update the problem tab info (left side)
        document.getElementById('current-challenge-id').textContent = this.currentChallenge.id;
        document.getElementById('current-challenge-title').textContent = this.currentChallenge.title;
        
        // Render markdown description using proper rendering like challenge page
        const descElement = document.getElementById('current-description');
        if (this.currentChallenge.description) {
            // Show loading while processing
            descElement.innerHTML = `
                <div class="d-flex align-items-center text-muted">
                    <div class="spinner-border spinner-border-sm me-2" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    Loading challenge description...
                </div>
            `;

            // Use proper markdown rendering if available
            if (typeof renderMarkdownAndCleanup === 'function') {
                setTimeout(() => {
                    // Remove challenge headers like "Challenge 1: Basic Routing", "# Challenge 2: Middleware", etc.
                    let description = this.currentChallenge.description || '';
                    description = description.replace(/^#*\s*Challenge\s+\d+[:\-]\s*[^\n]+\n*/gim, '');
                    renderMarkdownAndCleanup(description, descElement);
                }, 100);
            } else {
                // Enhanced fallback markdown conversion
                let description = this.currentChallenge.description || '';
                description = description.replace(/^#*\s*Challenge\s+\d+[:\-]\s*[^\n]+\n*/gim, '');
            let html = description
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`([^`]+)`/g, '<code class="language-go">$1</code>')
                    .replace(/```go\n([\s\S]*?)\n```/g, '<pre><code class="language-golang">$1</code></pre>')
                    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                    .replace(/##\s+(.*)/g, '<h6 class="text-primary mt-3 mb-2">$1</h6>')
                    .replace(/#\s+(.*)/g, '<h5 class="text-primary mt-4 mb-3">$1</h5>');
                
                setTimeout(() => {
            descElement.innerHTML = html;
                    
                    // Apply syntax highlighting
                    descElement.querySelectorAll('pre code').forEach((el) => {
                        if (el.className === 'language-go') {
                            el.className = 'language-golang';
                        }
                        if (typeof hljs !== 'undefined') {
                            hljs.highlightElement(el);
                        }
                    });
                }, 100);
            }
        }
        
        // Update progress indicator - now move challenge pager to top area
        const totalChallenges = this.learningPlan.totalChallenges;
        const completedChallenges = this.progress.completedChallenges || [];
        
        // Put the challenge pager buttons in the top indicator area
        const progressIndicator = document.getElementById('progress-indicator');
        if (progressIndicator) {
            // Generate the same buttons that were in challenge-pager
            let buttonsHtml = '';
            for (let i = 0; i < Math.min(totalChallenges, 10); i++) { // Show max 10 buttons
                // Determine challenge ID for this index
                let challengeId;
                if (i < this.learningPlan.basicChallenges.length) {
                    challengeId = this.learningPlan.basicChallenges[i];
                } else {
                    challengeId = `pkg_${i}`;
                }
                
                // Style based on status
                let buttonClass, buttonContent, buttonTitle;
                if (completedChallenges.includes(challengeId) || 
                    (typeof challengeId === 'number' && completedChallenges.includes(challengeId))) {
                    buttonClass = 'btn btn-success btn-sm me-1';
                    buttonContent = `<i class="bi bi-check-circle-fill me-1"></i>${i + 1}`;
                    buttonTitle = 'Challenge completed';
                } else if (i === this.currentChallengeIndex) {
                    buttonClass = 'btn btn-primary btn-sm me-1';
                    buttonContent = i + 1;
                    buttonTitle = 'Current challenge';
                } else if (i < this.currentChallengeIndex) {
                    buttonClass = 'btn btn-outline-success btn-sm me-1';
                    buttonContent = i + 1;
                    buttonTitle = 'Available challenge';
                } else {
                    buttonClass = 'btn btn-outline-secondary btn-sm me-1';
                    buttonContent = i + 1;
                    buttonTitle = 'Locked challenge';
                }
                
                const disabled = i > this.currentChallengeIndex ? 'disabled' : '';
                // Remove me-1 class to reduce spacing between buttons
                const cleanButtonClass = buttonClass.replace(' me-1', '');
                buttonsHtml += `<button type="button" class="${cleanButtonClass}" title="${buttonTitle}" ${disabled} onclick="companyOnboarding.navigateToChallenge(${i})">${buttonContent}</button>`;
            }
            
            // Add previous/next navigation buttons with the challenge pager
            const prevDisabled = this.currentChallengeIndex === 0 ? 'disabled' : '';
            const nextDisabled = this.currentChallengeIndex >= totalChallenges - 1 ? 'disabled' : '';
            
            // Remove the dark background classes and add light styling
            progressIndicator.className = 'px-3 py-2 rounded border bg-light';
            progressIndicator.innerHTML = `
                <div class="btn-group btn-group-sm" role="group">
                    <button type="button" class="btn btn-outline-primary" ${prevDisabled} onclick="companyOnboarding.previousChallenge()" title="Previous Challenge">
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttonsHtml}
                    <button type="button" class="btn btn-outline-primary" ${nextDisabled} onclick="companyOnboarding.nextChallenge()" title="Next Challenge">
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            `;
        }
        
        // Clear both the challenge pager and navigation buttons beside Run Tests since we moved them to top
        this.clearBottomNavigation();
        
        // The session container is already visible, just ensure it's shown
        const sessionElement = document.getElementById('onboarding-session');
        if (sessionElement) {
            sessionElement.style.display = 'block';
        }
        
        this.loadLearningMaterials();
    }

    clearBottomNavigation() {
        // Clear the challenge pager and navigation buttons beside Run Tests since we moved them to top
        const pager = document.getElementById('challenge-pager');
        if (pager) {
            pager.innerHTML = '';
        }
        
        // Hide the navigation buttons beside Run Tests
        const prevBtn = document.getElementById('prev-challenge');
        const nextBtn = document.getElementById('next-challenge');
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }

    initializeEditor() {
        // Show loading indicator while initializing
        this.showEditorLoading(true);
        
        // Dispose of existing editor if it exists
        if (this.editor) {
            this.editor.destroy();
        }

        if (this.testEditor) {
            this.testEditor.destroy();
        }

        // Wait for Ace editor to be available
        if (typeof ace === 'undefined') {
            console.log('Ace editor not yet loaded, waiting...');
            setTimeout(() => this.initializeEditor(), 100);
            return;
        }

        if (this.currentChallenge) {
            try {
                // Load saved content or use template
                const savedContent = this.loadEditorContent();
                const initialContent = savedContent || 
                    this.currentChallenge.template || 
                    '// Write your solution here\npackage main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}';

                // Create main solution editor using Ace (same as interview page)
                this.editor = createEditor('editor', initialContent);

                // Update position indicator when cursor moves
                this.editor.on('changeCursor', () => {
                    const cursor = this.editor.getCursorPosition();
                const lineEl = document.getElementById('line-number');
                const colEl = document.getElementById('col-number');
                if (lineEl && colEl) {
                        lineEl.textContent = cursor.row + 1;
                        colEl.textContent = cursor.column + 1;
                    }
                });

                // Set up auto-save on content change
                this.userHasTyped = false;
                this.pendingSave = false;
                
                this.editor.on('change', (delta) => {
                    // Only save if this is a user-initiated change (not programmatic)
                    if (delta.action === 'insert' || delta.action === 'remove') {
                        this.userHasTyped = true;
                        this.pendingSave = true;
                        // Reset timer to trigger save on next interval
                        this.lastSaveTime = 0;
                    }
                });

                // Start auto-save
                this.startAutoSave();

                // Initialize test editor if available
            if (this.currentChallenge.testFile) {
                const testEditorEl = document.getElementById('test-editor');
                    if (testEditorEl) {
                        this.testEditor = createEditor('test-editor', this.currentChallenge.testFile, true);
                    }
                }

                // Hide loading indicator
                this.showEditorLoading(false);
                
                console.log('Editor initialized successfully');
                
                // Initialize editor toolbar buttons
                this.initializeEditorButtons();
                
                // Show initial save status if content was loaded
                if (savedContent) {
                    this.showSaveIndicator('saved');
                } else {
                    // Reset typing flags for new challenge
                    this.userHasTyped = false;
                    this.pendingSave = false;
                }
            } catch (error) {
                console.error('Error initializing editor:', error);
                this.showEditorLoading(false);
                this.showToast('Error', 'Failed to initialize code editor', 'error');
            }
        }
    }

    showEditorLoading(show) {
        const editorContainer = document.getElementById('editor');
        if (!editorContainer) return;

        if (show) {
            editorContainer.innerHTML = `
                <div class="d-flex justify-content-center align-items-center h-100">
                    <div class="text-center">
                        <div class="spinner-border text-primary mb-3" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <div class="text-muted">Loading code editor...</div>
                    </div>
                </div>
            `;
        }
        // If hide, createEditor will replace the content
    }

    async loadLearningMaterials() {
        if (!this.currentChallenge) return;
        
        try {
            const learningContent = document.getElementById('learning-content');
            if (!learningContent) return;

            // Show loading indicator
            learningContent.innerHTML = `
                <div class="d-flex justify-content-center align-items-center py-4">
                    <div class="text-center">
                        <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <span class="text-muted">Loading learning materials...</span>
                    </div>
                </div>
            `;

            // Use proper markdown rendering like challenge page
            if (this.currentChallenge.learningMaterials) {
                // Use the renderMarkdown function from main.js for proper syntax highlighting
                if (typeof renderMarkdown === 'function') {
                    renderMarkdown(this.currentChallenge.learningMaterials, learningContent);
                } else {
                    // Fallback: enhanced markdown conversion
                let html = this.currentChallenge.learningMaterials
                    .replace(/\n/g, '<br>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/`([^`]+)`/g, '<code class="language-go">$1</code>')
                        .replace(/```go\n([\s\S]*?)\n```/g, '<pre><code class="language-golang">$1</code></pre>')
                        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                        .replace(/##\s+(.*)/g, '<h6 class="text-primary mt-3 mb-2">$1</h6>')
                        .replace(/#\s+(.*)/g, '<h5 class="text-primary mt-4 mb-3">$1</h5>');
                    
                learningContent.innerHTML = html;
                    
                    // Apply syntax highlighting
                    setTimeout(() => {
                        learningContent.querySelectorAll('pre code').forEach((el) => {
                            if (el.className === 'language-go') {
                                el.className = 'language-golang';
                            }
                            if (typeof hljs !== 'undefined') {
                                hljs.highlightElement(el);
                            }
                        });
                    }, 100);
                }

                // Initialize learning materials highlighting system like challenge page
                if (typeof initLearningMaterials === 'function') {
                    setTimeout(() => {
                        initLearningMaterials('learning-content', this.currentChallenge.id);
                    }, 200);
                }
            } else {
                learningContent.innerHTML = `
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle me-2"></i>
                        <strong>Learning materials coming soon!</strong><br>
                        This challenge doesn't have specific learning materials yet, but you can use the AI Mentor for guidance.
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading learning materials:', error);
            const learningContent = document.getElementById('learning-content');
            if (learningContent) {
                learningContent.innerHTML = `
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Failed to load learning materials. Please try refreshing the page.
                    </div>
                `;
            }
        }
    }

    async runTests() {
        if (!this.editor) {
            this.showToast('Error', 'Editor not initialized', 'error');
            return;
        }

        const runBtn = document.getElementById('run-button');
        const runSpinner = document.getElementById('run-spinner');
        const runText = document.getElementById('run-text');
        
        runBtn.disabled = true;
        runSpinner.classList.remove('d-none');
        runText.innerHTML = '<i class="bi bi-hourglass me-1"></i>Running...';

        try {
            const code = this.editor.getValue();
            
            if (!code.trim()) {
                this.showToast('Error', 'Please write some code before running tests', 'error');
                return;
            }

            console.log('Running tests for challenge:', this.currentChallenge.id);
            
            let response;
            if (this.currentChallenge.isPackageChallenge) {
                // Use package challenge API
                const challengeId = this.currentChallenge.actualChallengeId;
                response = await fetch(`/api/packages/${this.currentChallenge.packageName}/${challengeId}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        code: code,
                        username: this.getUsername()
                    })
                });
            } else {
                // Use regular challenge API
                response = await fetch(`/api/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        challengeId: this.currentChallenge.id,
                        code: code 
                    })
                });
            }

            const result = await response.json();
            console.log('Test result:', result);
            this.displayTestResults(result);

        } catch (error) {
            console.error('Error running tests:', error);
            this.showToast('Error', 'Failed to run tests. Please try again.', 'error');
        } finally {
            runBtn.disabled = false;
            runSpinner.classList.add('d-none');
            runText.innerHTML = '<i class="bi bi-play me-1"></i>Run Tests';
        }
    }

    displayTestResults(result) {
        const resultsTab = document.getElementById('test-results');
        
        // Check if tests actually passed by examining the output
        const isPassed = result.success || 
                        (result.output && result.output.includes('PASS') && !result.output.includes('FAIL'));
        
        // Format output for better readability
        let formattedOutput = result.output || '';
        if (typeof formatTestOutput === 'function') {
            formattedOutput = formatTestOutput(formattedOutput);
        } else {
            // Fallback formatting
            formattedOutput = formattedOutput
                .replace(/PASS/g, '<span class="text-success fw-bold">PASS</span>')
                .replace(/FAIL/g, '<span class="text-danger fw-bold">FAIL</span>')
                .replace(/--- PASS/g, '<span class="text-success">--- PASS</span>')
                .replace(/--- FAIL/g, '<span class="text-danger">--- FAIL</span>');
        }
        
        if (isPassed) {
            resultsTab.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle me-2"></i>
                    <strong>All tests passed!</strong>
                    ${result.execution_ms ? `<small class="ms-2 text-muted">(${result.execution_ms}ms)</small>` : ''}
                </div>
                <div class="bg-light border rounded p-3">
                    <pre class="mb-0" style="color: #333;">${formattedOutput}</pre>
                </div>
            `;
        } else {
            resultsTab.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-x-circle me-2"></i>
                    <strong>Some tests failed</strong>
                    ${result.execution_ms ? `<small class="ms-2 text-muted">(${result.execution_ms}ms)</small>` : ''}
                </div>
                <div class="bg-light border rounded p-3">
                    <pre class="mb-0" style="color: #333;">${formattedOutput}</pre>
                </div>
            `;
        }

        const resultsTabBtn = document.getElementById('results-tab');
        if (resultsTabBtn) {
            new bootstrap.Tab(resultsTabBtn).show();
        }
    }

    async submitSolution() {
        if (!this.editor) {
            this.showToast('Error', 'Editor not initialized', 'error');
            return;
        }

        const submitBtn = document.getElementById('submit-button');
        const submitSpinner = document.getElementById('submit-spinner');
        const submitText = document.getElementById('submit-text');
        
        // Disable button and show loading
        submitBtn.disabled = true;
        submitSpinner.classList.remove('d-none');
        submitText.textContent = 'Submitting...';

        try {
            const code = this.editor.getValue();
            
            if (!code.trim()) {
                this.showToast('Error', 'Please write some code before submitting', 'error');
                return;
            }

            console.log('Submitting solution for challenge:', this.currentChallenge.id);
            console.log('Code length:', code.length);

            let response;
            if (this.currentChallenge.isPackageChallenge) {
                // Use package challenge API
                const challengeId = this.currentChallenge.actualChallengeId;
                response = await fetch(`/api/packages/${this.currentChallenge.packageName}/${challengeId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        code: code,
                        username: this.getUsername()
                    })
                });
            } else {
                // Use regular challenge API
                response = await fetch(`/api/submissions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        challengeId: this.currentChallenge.id,
                        code: code,
                        username: this.getUsername()
                    })
                });
            }

            const result = await response.json();
            console.log('Submit response:', result);
            
            if (result.success || result.passed) {
                this.showToast('Success', 'Solution submitted successfully!', 'success');
                this.markChallengeComplete();
            } else {
                this.showToast('Error', result.message || 'Submission failed', 'error');
            }

        } catch (error) {
            console.error('Error submitting solution:', error);
            this.showToast('Error', 'Failed to submit solution. Please try again.', 'error');
        } finally {
            // Re-enable button
            submitBtn.disabled = false;
            submitSpinner.classList.add('d-none');
            submitText.textContent = 'Submit Solution';
        }
    }

    markChallengeComplete() {
        if (!this.progress.completedChallenges) {
            this.progress.completedChallenges = [];
        }
        
        if (!this.progress.completedChallenges.includes(this.currentChallenge.id)) {
            this.progress.completedChallenges.push(this.currentChallenge.id);
            this.saveProgress();
            
            // Update progress displays
            this.updateProgress();
            this.updateNavigation();
            this.updateChallengePager();
            
            // Show completion celebration
            this.showCompletionCelebration();
        }

        setTimeout(() => {
            this.nextChallenge();
            // Auto-switch to solution tab after moving to next challenge
            setTimeout(() => {
                this.switchToSolutionTab();
            }, 500);
        }, 3000);
    }

    switchToSolutionTab() {
        const solutionTab = document.getElementById('solution-tab');
        if (solutionTab) {
            const tab = new bootstrap.Tab(solutionTab);
            tab.show();
        }
    }

    updateChallengePager() {
        // This function is now integrated into the main progress indicator update
        // The pager buttons and navigation are now shown in the top area, not beside Run Tests
        this.clearBottomNavigation();
    }

    navigateToChallenge(index) {
        // Save current progress before switching
        if (this.editor && this.currentChallenge) {
            this.saveEditorContent();
        }
        
        this.currentChallengeIndex = index;
        this.loadCurrentChallenge();
        this.showToast('Navigation', `Switched to challenge ${index + 1}`, 'info');
    }

    showCompletionCelebration() {
        const celebration = document.createElement('div');
        celebration.className = 'position-fixed top-50 start-50 translate-middle';
        celebration.style.zIndex = '9999';
        celebration.innerHTML = `
            <div class="card border-success shadow-lg" style="min-width: 300px;">
                <div class="card-body text-center bg-success text-white">
                    <i class="bi bi-check-circle-fill fs-1 mb-2"></i>
                    <h5 class="card-title">Challenge Complete! 🎉</h5>
                    <p class="card-text mb-0">Great job! Moving to the next challenge...</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(celebration);
        
        // Remove after 2.5 seconds
        setTimeout(() => {
            if (celebration.parentNode) {
                celebration.parentNode.removeChild(celebration);
            }
        }, 2500);
    }

    nextChallenge() {
        if (this.currentChallengeIndex < this.learningPlan.totalChallenges - 1) {
            this.currentChallengeIndex++;
            // Reset editor state for new challenge
            this.userHasTyped = false;
            this.pendingSave = false;
            this.loadCurrentChallenge();
        } else {
            this.showToast('Congratulations!', 'You have completed all challenges!', 'success');
        }
    }

    previousChallenge() {
        if (this.currentChallengeIndex > 0) {
            this.currentChallengeIndex--;
            this.loadCurrentChallenge();
        }
    }

    async requestAIReview() {
        if (!this.editor) {
            this.showToast('Error', 'Editor not available', 'error');
            return;
        }
        
        const code = this.editor.getValue();
        if (!code.trim()) {
            this.showToast('Info', 'Please write some code first before requesting a review!', 'warning');
            return;
        }

        if (!this.currentChallenge) {
            this.showToast('Error', 'No challenge selected. Please start a challenge first!', 'error');
            return;
        }

        this.showAILoading('Getting AI Code Review...');
        
        try {
            // Build context for better AI prompting
            const challengeType = this.currentChallenge.isPackageChallenge ? 'Package Challenge' : 'Basic Challenge';
            const packageInfo = this.currentChallenge.isPackageChallenge ? 
                ` (${this.currentChallenge.packageName.toUpperCase()} - ${this.currentChallenge.title})` : '';
            const currentPosition = this.currentChallengeIndex + 1;
            const totalChallenges = this.getTotalChallenges();
            const progressInfo = `Challenge ${currentPosition} of ${totalChallenges}`;
            console.log('AI Review Progress Info:', progressInfo, 'Index:', this.currentChallengeIndex, 'Total:', totalChallenges);
            
                        // For package challenges, convert to a regular challenge ID for the AI API
            // or send minimal fields that the AI API expects
            let apiChallengeId = this.currentChallenge.id;
            let requestPayload = {
                code: code,
                context: `Company onboarding session - ${challengeType}${packageInfo}. ${progressInfo}. Student is learning Go programming through guided challenges. Challenge: ${this.currentChallenge.title}. Mentor Style: constructive_learning.`
            };

            // Handle regular vs package challenges differently
            if (this.currentChallenge.isPackageChallenge) {
                // For package challenges, use the position in the learning plan
                const basicChallengeCount = this.selectedBasicChallenges.length;
                const packageChallengeIndex = this.currentChallengeIndex - basicChallengeCount;
                const mappedChallengeId = Math.min(packageChallengeIndex + 1, 10);
                requestPayload.challengeId = mappedChallengeId;
                requestPayload.context += ` [Package Challenge: ${this.currentChallenge.packageName}/${this.currentChallenge.actualChallengeId}. This is a ${this.currentChallenge.packageName} framework challenge, not a basic algorithm challenge.]`;
            } else {
                // For regular challenges, parse the numeric ID
                requestPayload.challengeId = parseInt(this.currentChallenge.id) || 1;
            }

            const response = await fetch('/api/ai/code-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const responseText = await response.text();
            console.log('AI Review Response Text:', responseText);
            
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                console.log('Raw response that failed to parse:', responseText);
                
                // Try to extract and display partial information
                result = this.handlePartialAIResponse(responseText);
            }
            
            if (!result || typeof result !== 'object') {
                throw new Error('Invalid response format from AI service');
            }
            
            this.displayAIReview(result);
            
        } catch (error) {
            console.error('AI Review Error:', error);
            
            // Show a more helpful error message
            let errorMessage = 'Failed to get AI review: ';
            if (error.message.includes('JSON')) {
                errorMessage += 'The AI service returned an incomplete response. Please try again.';
            } else if (error.message.includes('HTTP 400')) {
                errorMessage += 'Invalid request format. Please check your code and try again.';
            } else if (error.message.includes('HTTP 500')) {
                errorMessage += 'The AI service is temporarily unavailable. Please try again in a moment.';
            } else {
                errorMessage += error.message;
            }
            
            this.showAIError(errorMessage);
        }
    }

    async requestInterviewQuestions() {
        if (!this.currentChallenge) {
            this.showToast('Error', 'No challenge selected. Please start a challenge first!', 'error');
            return;
        }

        this.showAILoading('Generating Mentoring Questions...');
        
        try {
            const code = this.editor ? this.editor.getValue() : '';
            const challengeType = this.currentChallenge.isPackageChallenge ? 'Package Challenge' : 'Basic Challenge';
            const packageInfo = this.currentChallenge.isPackageChallenge ? 
                ` (${this.currentChallenge.packageName.toUpperCase()})` : '';
            const progressInfo = `Challenge ${this.currentChallengeIndex + 1} of ${this.getTotalChallenges()}`;
            
            // Prepare request payload for AI interview questions
            let requestPayload = {
                code: code,
                userProgress: progressInfo
            };

            // Handle regular vs package challenges  
            if (this.currentChallenge.isPackageChallenge) {
                // For package challenges, use the position in the learning plan
                const basicChallengeCount = this.selectedBasicChallenges.length;
                const packageChallengeIndex = this.currentChallengeIndex - basicChallengeCount;
                const mappedChallengeId = Math.min(packageChallengeIndex + 1, 10);
                requestPayload.challengeId = mappedChallengeId;
                requestPayload.userProgress += ` [Package: ${this.currentChallenge.packageName}/${this.currentChallenge.actualChallengeId}. This is a ${this.currentChallenge.packageName} framework challenge.]`;
            } else {
                requestPayload.challengeId = parseInt(this.currentChallenge.id) || 1;
            }

            const response = await fetch('/api/ai/interviewer-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('AI Questions Response:', result);
            
            // Handle both direct array and object with questions property
            const questions = result.questions || result;
            this.displayInterviewQuestions(questions);
            
        } catch (error) {
            console.error('AI Questions Error:', error);
            this.showAIError('Failed to get mentoring questions: ' + error.message);
        }
    }

    async requestHint(level = 1) {
        if (!this.currentChallenge) {
            this.showToast('Error', 'No challenge selected. Please start a challenge first!', 'error');
            return;
        }

        this.showAILoading(`Getting Learning Hint (Level ${level})...`);
        
        try {
            const code = this.editor ? this.editor.getValue() : '';
            const challengeType = this.currentChallenge.isPackageChallenge ? 'Package Challenge' : 'Basic Challenge';
            const packageInfo = this.currentChallenge.isPackageChallenge ? 
                ` (${this.currentChallenge.packageName.toUpperCase()})` : '';
            const progressInfo = `Challenge ${this.currentChallengeIndex + 1} of ${this.getTotalChallenges()}`;
            
            // Prepare request payload for AI hints
            let requestPayload = {
                code: code,
                hintLevel: level
            };

            // Handle regular vs package challenges
            if (this.currentChallenge.isPackageChallenge) {
                // For package challenges, we need to send the challenge title and description as context
                // Since package challenges don't map to basic challenge IDs, use a generic ID
                requestPayload.challengeId = 1; // Use generic ID for package challenges
                
                // Provide comprehensive context for the AI to understand this specific package challenge
                const challengeDescription = this.currentChallenge.description || 'No description available';
                requestPayload.context = `Package Challenge: ${this.currentChallenge.packageName.toUpperCase()} Framework
Title: ${this.currentChallenge.title}
Challenge ID: ${this.currentChallenge.actualChallengeId}
Position: ${progressInfo}
Description: ${challengeDescription.substring(0, 500)}
This is a practical ${this.currentChallenge.packageName} framework implementation challenge. Please provide hints specific to ${this.currentChallenge.packageName} development, not basic algorithm problems.`;
                
                console.log('Package challenge hint request:', {
                    packageName: this.currentChallenge.packageName,
                    actualChallengeId: this.currentChallenge.actualChallengeId,
                    title: this.currentChallenge.title,
                    challengeId: requestPayload.challengeId,
                    context: requestPayload.context
                });
            } else {
                // For basic challenges, use the actual challenge ID
                requestPayload.challengeId = parseInt(this.currentChallenge.id) || 1;
                requestPayload.context = `Basic challenge ${this.currentChallenge.id}: "${this.currentChallenge.title}". Position: ${progressInfo}`;
                
                console.log('Basic challenge hint request:', {
                    challengeId: requestPayload.challengeId,
                    title: this.currentChallenge.title,
                    context: requestPayload.context
                });
            }

            console.log('Sending hint request to API:', requestPayload);
            
            const response = await fetch('/api/ai/code-hint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('AI Hint Response:', result);
            
            this.displayHint(result.hint, level);

        } catch (error) {
            console.error('AI Hint Error:', error);
            this.showAIError('Failed to get learning hint: ' + error.message);
        }
    }

    getTotalChallenges() {
        if (!this.selectedBasicChallenges || !this.selectedPackages) {
            return 1; // Fallback
        }
        return this.selectedBasicChallenges.length + (this.selectedPackages.length * 2);
    }

    showAILoading(message) {
        const responseArea = document.getElementById('ai-response-area');
        const title = document.getElementById('ai-response-title');
        const content = document.getElementById('ai-response-content');
        
        if (!responseArea || !title || !content) return;
        
        title.textContent = 'AI Mentor Thinking...';
        content.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                <span class="text-muted">${message}</span>
            </div>
        `;
        responseArea.style.display = 'block';
        
        // Auto-switch to AI tab
        const aiTab = document.getElementById('ai-tab');
        if (aiTab) {
            new bootstrap.Tab(aiTab).show();
        }
    }

    showAIError(message) {
        const title = document.getElementById('ai-response-title');
        const content = document.getElementById('ai-response-content');
        
        if (!title || !content) return;
        
        title.textContent = 'AI Mentor Error';
        content.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>Oops!</strong> ${message}
                <hr class="my-2">
                <small class="text-muted">
                    💡 Try again in a moment, or continue with the challenge. You've got this!
                </small>
            </div>
        `;
    }

    displayAIReview(review) {
        const title = document.getElementById('ai-response-title');
        const content = document.getElementById('ai-response-content');
        
        if (!title || !content) return;
        
        console.log('Displaying AI Review:', review); // Debug log
        
        // Helper to render markdown when available (same as interview.html)
        const md = (text) => {
            if (!text) return '';
            const safe = text.toString();
            if (typeof marked !== 'undefined') {
                try { 
                    return marked.parse(safe, { breaks: true }); 
                } catch { 
                    return this.escapeHtml(safe).replace(/\n/g, '<br/>'); 
                }
            }
            return this.escapeHtml(safe).replace(/\n/g, '<br/>');
        };

        // Provide defaults for missing properties (same as interview.html)
        const overallScore = review.overall_score || 0;
        const readabilityScore = review.readability_score || 0;
        const interviewerFeedback = review.interviewer_feedback || review.mentor_feedback || 'No feedback available';
        
        title.textContent = `AI Code Review (Score: ${overallScore}/100)`;
        
        let html = `
            <div class="row mb-3">
                <div class="col-md-6">
                    <div class="badge bg-${this.getScoreColor(overallScore)} fs-6">
                        Overall Score: ${overallScore}/100
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="badge bg-info fs-6">
                        Readability: ${readabilityScore}/100
                    </div>
                </div>
            </div>
            
            <div class="mb-3">
                <h6><i class="bi bi-chat-quote-fill me-1"></i>Mentor Feedback:</h6>
                <div class="alert alert-light p-2 small">
                    <div class="markdown-content" style="padding: 0;">${typeof marked !== 'undefined' ? marked.parse(interviewerFeedback) : this.escapeHtml(interviewerFeedback)}</div>
                </div>
            </div>
        `;
        
        if (review.issues && Array.isArray(review.issues) && review.issues.length > 0) {
            html += `
                <div class="mb-3">
                    <h6><i class="bi bi-exclamation-triangle me-1"></i>Issues Found:</h6>
                    ${review.issues.map(issue => `
                        <div class="alert alert-${this.getSeverityColor(issue.severity)} p-2 small mb-1">
                            <div><strong>${this.escapeHtml((issue.type||'').toString().toUpperCase())}:</strong></div>
                            <div class="markdown-content" style="padding:0; margin-top: .25rem;">${md(issue.description)}</div>
                            ${issue.solution ? `<div class="mt-1"><em>Solution:</em><div class="markdown-content" style="padding:0;">${md(issue.solution)}</div></div>` : ''}
                            ${issue.line ? `<div class="mt-1"><small class="text-muted">Line: ${issue.line}</small></div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (review.suggestions && Array.isArray(review.suggestions) && review.suggestions.length > 0) {
            html += `
                <div class="mb-3">
                    <h6><i class="bi bi-lightbulb me-1"></i>Suggestions:</h6>
                    ${review.suggestions.map(suggestion => `
                        <div class="alert alert-info p-2 small mb-1">
                            <div><strong>${this.escapeHtml(suggestion.category || suggestion.priority || '')}:</strong></div>
                            <div class="markdown-content" style="padding:0; margin-top: .25rem;">${md(suggestion.description)}</div>
                            ${suggestion.example ? `<div class="mt-1"><em>Example:</em><div class="markdown-content" style="padding:0;"><pre><code>${this.escapeHtml(suggestion.example)}</code></pre></div></div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (review.complexity) {
            html += `
                <div class="mb-3">
                    <h6><i class="bi bi-speedometer me-1"></i>Complexity Analysis:</h6>
                    <div class="alert alert-light p-2 small">
                        <div class="mb-2">
                            <strong>Time Complexity:</strong> <code>${this.escapeHtml(review.complexity.time_complexity || 'N/A')}</code>
                        </div>
                        <div class="mb-2">
                            <strong>Space Complexity:</strong> <code>${this.escapeHtml(review.complexity.space_complexity || 'N/A')}</code>
                        </div>
                        ${review.complexity.can_optimize && review.complexity.optimized_approach ? 
                            `<div><strong>Optimization:</strong><div class="markdown-content mt-1" style="padding:0;">${md(review.complexity.optimized_approach)}</div></div>` : 
                            ''}
                    </div>
                </div>
            `;
        }

        if (review.follow_up_questions && Array.isArray(review.follow_up_questions) && review.follow_up_questions.length > 0) {
            html += `
                <div class="mb-3">
                    <h6><i class="bi bi-question-circle me-1"></i>Follow-up Questions:</h6>
                    <div class="alert alert-secondary p-2 small">
                        <ol class="mb-0 ps-3">
                            ${review.follow_up_questions.map(q => `<li>${this.escapeHtml(q)}</li>`).join('')}
                        </ol>
                    </div>
                </div>
            `;
        }
        
        content.innerHTML = html;
        
        // Apply syntax highlighting to code blocks
        setTimeout(() => {
            content.querySelectorAll('pre code').forEach((el) => {
                if (typeof hljs !== 'undefined') {
                    hljs.highlightElement(el);
                }
            });
        }, 100);
    }

    // Handle partial or malformed AI responses
    handlePartialAIResponse(responseText) {
        try {
            // Try to extract useful information from partial JSON
            const lines = responseText.split('\n');
            let extractedInfo = {
                overall_score: 0,
                issues: [],
                suggestions: [],
                mentor_feedback: 'I\'m having trouble analyzing your code automatically.',
                complexity: null,
                follow_up_questions: []
            };

            // Look for score
            const scoreMatch = responseText.match(/"overall_score":\s*(\d+)/);
            if (scoreMatch) {
                extractedInfo.overall_score = parseInt(scoreMatch[1]);
            }

            // Try to find the readable message before the JSON
            const messageMatch = responseText.match(/^([^{]+)/);
            if (messageMatch && messageMatch[1].trim()) {
                extractedInfo.mentor_feedback = messageMatch[1].trim();
            }

            // Try to extract complete or partial issues array
            const issuesMatch = responseText.match(/"issues":\s*\[(.*?)(?:\]|$)/s);
            if (issuesMatch) {
                try {
                    // Try to repair incomplete JSON
                    let issuesText = issuesMatch[1];
                    
                    // If the text ends abruptly, try to close it properly
                    if (!issuesText.endsWith('}')) {
                        // Find the last complete object
                        const objects = issuesText.split(/},\s*{/);
                        if (objects.length > 1) {
                            // Keep only complete objects
                            issuesText = objects.slice(0, -1).join('},{') + '}';
                        } else if (objects[0].includes('"type"') && objects[0].includes('"description"')) {
                            // Try to complete the single object
                            issuesText = objects[0];
                            if (!issuesText.endsWith('}')) {
                                issuesText += '"}';
                            }
                        }
                    }
                    
                    const issuesJson = `[${issuesText}]`;
                    console.log('Attempting to parse issues JSON:', issuesJson);
                    extractedInfo.issues = JSON.parse(issuesJson);
                } catch (e) {
                    console.error('Failed to parse issues, creating fallback:', e);
                    // Extract readable message before JSON as the issue description
                    const messageMatch = responseText.match(/^([^{]+)/);
                    const messageText = messageMatch ? messageMatch[1].trim() : 'AI response parsing issue: Incomplete JSON response';
                    
                    extractedInfo.issues = [{
                        type: "parsing",
                        severity: "medium",
                        description: messageText,
                        solution: "Try running the AI review again, or check your code for syntax issues."
                    }];
                }
            } else {
                // No issues found, extract any readable message
                const messageMatch = responseText.match(/^([^{]+)/);
                const messageText = messageMatch ? messageMatch[1].trim() : 'AI response parsing issue: Incomplete JSON response';
                
                extractedInfo.issues = [{
                    type: "parsing",
                    severity: "medium", 
                    description: messageText,
                    solution: "Try running the AI review again, or check your code for syntax issues."
                }];
            }

            // Add fallback suggestions
            extractedInfo.suggestions = [{
                category: "troubleshooting",
                priority: "medium",
                description: "If this keeps happening, try simplifying your code or breaking it into smaller functions."
            }];

            // Add fallback complexity
            extractedInfo.complexity = {
                time_complexity: "Unable to analyze",
                space_complexity: "Unable to analyze"
            };

            // Add fallback questions
            extractedInfo.follow_up_questions = [
                "Can you explain your algorithm step by step?",
                "What's the time complexity of your solution?",
                "How would you handle edge cases?"
            ];

            console.log('Extracted partial info:', extractedInfo);
            return extractedInfo;

        } catch (error) {
            console.error('Error handling partial response:', error);
            
            // Extract any readable content from the truncated response
            const readableMessage = responseText.match(/^([^{]+)/);
            const partialMessage = readableMessage ? readableMessage[1].trim() : "I'm having trouble analyzing your code automatically.";
            
            // Try to find any score information
            let partialScore = 0;
            const scoreMatch = responseText.match(/"overall_score":\s*(\d+)/);
            if (scoreMatch) {
                partialScore = parseInt(scoreMatch[1]);
            }
            
            // Return a fallback response with any recovered information
            return {
                overall_score: partialScore,
                issues: [{
                    type: "parsing",
                    severity: "high", 
                    description: "AI response was incomplete. Partial response: " + responseText.substring(0, 300) + (responseText.length > 300 ? '... [truncated]' : ''),
                    solution: "The AI service returned an incomplete response. Please try again."
                }],
                suggestions: [{
                    category: "troubleshooting", 
                    priority: "high",
                    description: "The response was cut off mid-transmission. This could be due to network issues or AI service timeout."
                }],
                mentor_feedback: partialMessage + " Let's focus on the core logic - can you walk me through your approach?",
                complexity: {
                    time_complexity: "Unable to analyze due to incomplete response",
                    space_complexity: "Unable to analyze due to incomplete response"
                },
                follow_up_questions: [
                    "Can you explain your algorithm step by step?",
                    "What's the time complexity of your solution?", 
                    "How would you handle edge cases?",
                    "Would you like to try the AI review again?"
                ]
            };
        }
    }

    // Helper functions for AI review formatting (same as interview.html)
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getScoreColor(score) {
        if (score >= 80) return 'success';
        if (score >= 60) return 'warning';
        return 'danger';
    }

    getSeverityColor(severity) {
        switch ((severity || '').toLowerCase()) {
            case 'critical': return 'danger';
            case 'high': return 'danger';
            case 'medium': return 'warning';
            case 'low': return 'info';
            case 'warning': return 'warning';
            default: return 'secondary';
        }
    }

    formatStructuredReview(review) {
        let html = '';
        
        // Overall score
        if (review.overall_score !== undefined) {
            const scoreClass = review.overall_score >= 8 ? 'success' : review.overall_score >= 6 ? 'warning' : 'danger';
            html += `
                <div class="alert alert-${scoreClass} mb-3">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-award me-2"></i>
                        <strong>Overall Score: ${review.overall_score}/10</strong>
                    </div>
                </div>
            `;
        }
        
        // Issues
        if (review.issues && review.issues.length > 0) {
            html += '<h6><i class="bi bi-exclamation-triangle me-2"></i>Issues Found</h6>';
            review.issues.forEach((issue, index) => {
                const severityClass = issue.severity === 'critical' ? 'danger' : issue.severity === 'warning' ? 'warning' : 'info';
                html += `
                    <div class="alert alert-${severityClass} p-3 mb-2" style="word-wrap: break-word; overflow-wrap: break-word;">
                        <div class="d-flex align-items-start">
                            <span class="badge bg-${severityClass} me-2 flex-shrink-0">${issue.type}</span>
                            <div class="flex-grow-1" style="min-width: 0;">
                                <strong style="word-break: break-word;">${issue.description}</strong>
                                ${issue.solution ? `<div class="mt-2"><small><strong>Solution:</strong> <span style="word-break: break-word;">${issue.solution}</span></small></div>` : ''}
                                ${issue.line_number ? `<div class="mt-1"><small class="text-muted">Line: ${issue.line_number}</small></div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        // Suggestions
        if (review.suggestions && review.suggestions.length > 0) {
            html += '<h6 class="mt-3"><i class="bi bi-lightbulb me-2"></i>Suggestions</h6>';
            review.suggestions.forEach((suggestion, index) => {
                const priorityClass = suggestion.priority === 'high' ? 'danger' : suggestion.priority === 'medium' ? 'warning' : 'info';
                html += `
                    <div class="card mb-2">
                        <div class="card-body p-3" style="word-wrap: break-word; overflow-wrap: break-word;">
                            <div class="d-flex align-items-start">
                                <span class="badge bg-${priorityClass} me-2 flex-shrink-0">${suggestion.priority}</span>
                                <div class="flex-grow-1" style="min-width: 0;">
                                    <div style="word-break: break-word;"><strong>${suggestion.category}:</strong> ${suggestion.description}</div>
                                    ${suggestion.example && suggestion.example !== 'N/A' ? `<div class="mt-2"><pre class="bg-light p-2 rounded" style="font-size: 0.85em; white-space: pre-wrap; word-break: break-word; overflow-x: auto; max-width: 100%;"><code class="language-go">${suggestion.example}</code></pre></div>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        // Interviewer feedback
        if (review.interviewer_feedback) {
            html += `
                <div class="mt-3">
                    <h6><i class="bi bi-person-check me-2"></i>Mentor Feedback</h6>
                    <div class="alert alert-primary">
                        ${review.interviewer_feedback}
                    </div>
                </div>
            `;
        }
        
        // Follow-up questions
        if (review.follow_up_questions && review.follow_up_questions.length > 0) {
            html += '<h6 class="mt-3"><i class="bi bi-chat-dots me-2"></i>Follow-up Questions</h6>';
            html += '<ul class="list-unstyled">';
            review.follow_up_questions.forEach((question, index) => {
                html += `<li class="mb-2"><i class="bi bi-arrow-right me-2"></i>${question}</li>`;
            });
            html += '</ul>';
        }
        
        // Complexity analysis
        if (review.complexity) {
            html += `
                <div class="mt-3">
                    <h6><i class="bi bi-cpu me-2"></i>Complexity Analysis</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <small class="text-muted">Time Complexity:</small>
                            <div class="badge bg-secondary">${review.complexity.time_complexity}</div>
                        </div>
                        <div class="col-md-6">
                            <small class="text-muted">Space Complexity:</small>
                            <div class="badge bg-secondary">${review.complexity.space_complexity}</div>
                        </div>
                    </div>
                    ${review.complexity.optimized_approach && review.complexity.optimized_approach !== 'N/A' ? 
                        `<div class="mt-2"><small><strong>Optimization:</strong> ${review.complexity.optimized_approach}</small></div>` : ''}
                </div>
            `;
        }
        
        return html;
    }

    displayInterviewQuestions(questions) {
        const title = document.getElementById('ai-response-title');
        const content = document.getElementById('ai-response-content');
        
        if (!title || !content) return;
        
        title.innerHTML = '<i class="bi bi-chat-dots me-2"></i>Mentoring Questions';
        
        let questionsArray = Array.isArray(questions) ? questions : [];
        if (questionsArray.length === 0 && questions.questions) {
            questionsArray = questions.questions;
        }
        
        if (questionsArray.length === 0) {
            content.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-chat-left-dots me-2"></i>
                    <strong>Great job so far!</strong> Keep working on your solution and I'll have some questions ready for you.
                </div>
            `;
            return;
        }
        
        const questionsHtml = questionsArray.map((q, index) => `
            <div class="question-item mb-3 p-3 border rounded">
                <div class="d-flex align-items-start">
                    <span class="badge bg-primary me-2 mt-1">${index + 1}</span>
                    <div class="flex-grow-1">
                        <div class="question-text">${q.question || q}</div>
                        ${q.context ? `<small class="text-muted mt-1 d-block"><i class="bi bi-info-circle me-1"></i>${q.context}</small>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        content.innerHTML = `
            <div class="mentoring-questions">
                <p class="text-muted mb-3">
                    <i class="bi bi-person-check me-1"></i>
                    Think through these questions to deepen your understanding:
                </p>
                ${questionsHtml}
                <div class="mt-3 p-2 bg-light rounded">
                    <small class="text-muted">
                        <i class="bi bi-lightbulb me-1"></i>
                        <strong>Tip:</strong> Discussing these concepts helps solidify your learning!
                    </small>
                </div>
            </div>
        `;
    }

    displayHint(hint, level) {
        const title = document.getElementById('ai-response-title');
        const content = document.getElementById('ai-response-content');
        
        if (!title || !content) return;
        
        title.innerHTML = `<i class="bi bi-lightbulb me-2"></i>Learning Hint - Level ${level}`;
        
        const renderMarkdown = (text) => {
            if (!text) return '';
            const safe = text.toString();
            if (typeof marked !== 'undefined') {
                try { 
                    return marked.parse(safe, { breaks: true }); 
                } catch(e) { 
                    return safe.replace(/\n/g, '<br>'); 
                }
            }
            return safe.replace(/\n/g, '<br>');
        };
        
        const hintHtml = renderMarkdown(hint);
        const nextLevel = level + 1;
        const hasNextLevel = nextLevel <= 3; // Maximum 3 hint levels
        
        const nextLevelButton = hasNextLevel ? 
            `<button class="btn btn-outline-warning btn-sm mt-2" onclick="companyOnboarding.requestHint(${nextLevel})">
                <i class="bi bi-arrow-right me-1"></i>Need Level ${nextLevel} Hint?
            </button>` : 
            `<small class="text-muted mt-2 d-block">
                <i class="bi bi-star me-1"></i>You've got all the hints! Time to implement your solution.
            </small>`;
        
        content.innerHTML = `
            <div class="learning-hint">
                <div class="alert alert-warning">
                    <div class="d-flex align-items-center mb-2">
                        <i class="bi bi-lightbulb-fill me-2"></i>
                        <strong>Hint Level ${level}</strong>
                        <span class="badge bg-warning text-dark ms-auto">${level === 1 ? 'Gentle' : level === 2 ? 'Guidance' : 'Direction'}</span>
                    </div>
                    <div class="markdown-content">${hintHtml}</div>
                    ${nextLevelButton}
                </div>
                <div class="mt-2">
                    <small class="text-muted">
                        <i class="bi bi-rocket me-1"></i>
                        Remember: The best learning happens when you figure things out yourself!
                    </small>
                </div>
            </div>
        `;
        
        // Apply syntax highlighting to code blocks
        setTimeout(() => {
            content.querySelectorAll('pre code').forEach((el) => {
                if (typeof hljs !== 'undefined') {
                    hljs.highlightElement(el);
                }
            });
        }, 100);
    }

    updateSessionMeta() {
        const meta = document.getElementById('session-meta');
        if (meta) {
            meta.textContent = `${this.selectedBasicChallenges.length} basic challenges + ${this.selectedPackages.length} packages`;
        }
    }



    resetProgress() {
        if (confirm('Are you sure you want to reset all progress? This will delete your current learning journey and start fresh.')) {
            // Stop auto-save
            this.stopAutoSave();
            
            // Clear all localStorage data for this session
            this.clearSessionData();
            
            // Generate new session ID
            localStorage.removeItem('company-onboarding-session-id');
            this.sessionId = this.generateSessionId();
            
            // Reset all state
            this.progress = {
                startTime: Date.now(),
                basics: [],
                packages: [],
                currentStep: 'overview',
                completedChallenges: [],
                sessionId: this.sessionId
            };
            this.selectedBasicChallenges = [];
            this.selectedPackages = [];
            this.currentChallengeIndex = 0;
            this.currentChallenge = null;
            this.learningPlan = null;
            
            this.saveProgress();
            
            // Reload the page to get fresh UI
            location.reload();
        }
    }

    clearSessionData() {
        // Clear all localStorage keys that start with this session ID
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.sessionId + '_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('Cleared', keysToRemove.length, 'localStorage items for session:', this.sessionId);
    }

    saveAndExit() {
        // Save current editor content before exiting
        if (this.editor && this.currentChallenge) {
            this.saveEditorContent();
        }
        
        this.stopAutoSave();
        this.saveProgress();
        
        document.getElementById('onboarding-session').style.display = 'none';
        document.getElementById('onboarding-overview').style.display = 'block';
        this.showToast('Progress Saved', 'Your progress has been saved', 'success');
    }

    updateProgress() {
        if (!this.progress.learningPlan) return;

        const totalChallenges = this.progress.learningPlan.totalChallenges || 0;
        const completedCount = this.progress.completedChallenges ? this.progress.completedChallenges.length : 0;
        const progressPercent = totalChallenges > 0 ? Math.round((completedCount / totalChallenges) * 100) : 0;

        // Update circular progress indicator
        const progressCircle = document.getElementById('progress-circle');
        const progressPercentage = document.getElementById('progress-percentage');
        
        if (progressCircle && progressPercentage) {
            const circumference = 2 * Math.PI * 40; // radius = 40
            const strokeDashoffset = circumference - (progressPercent / 100) * circumference;
            progressCircle.style.strokeDashoffset = strokeDashoffset;
            progressPercentage.textContent = progressPercent + '%';
        }

        // Fallback: Update old progress bar if exists
        const progressBar = document.getElementById('overall-progress');
        const progressText = document.getElementById('progress-text');
        
        if (progressBar) {
            progressBar.style.width = progressPercent + '%';
        }
        if (progressText) {
            progressText.textContent = progressPercent + '%';
        }

        // Update individual section progress
        this.updateBasicsProgress();
        this.updatePackagesProgress();
    }

    updateBasicsProgress() {
        const basicsProgress = document.getElementById('basics-progress');
        if (!basicsProgress || !this.progress.learningPlan) return;

        const basicChallenges = this.progress.learningPlan.basicChallenges || [];
        const completedBasics = this.progress.completedChallenges ? 
            this.progress.completedChallenges.filter(id => basicChallenges.includes(id)).length : 0;
        
        if (completedBasics === basicChallenges.length && basicChallenges.length > 0) {
            basicsProgress.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>${completedBasics}/${basicChallenges.length}`;
            basicsProgress.className = 'badge bg-success ms-auto';
        } else if (completedBasics > 0) {
            basicsProgress.innerHTML = `<i class="bi bi-clock-fill me-1"></i>${completedBasics}/${basicChallenges.length}`;
            basicsProgress.className = 'badge bg-warning ms-auto';
        } else {
            basicsProgress.textContent = `${completedBasics}/${basicChallenges.length}`;
            basicsProgress.className = 'badge bg-secondary ms-auto';
        }
    }

    updatePackagesProgress() {
        const packagesProgress = document.getElementById('packages-progress');
        if (!packagesProgress || !this.progress.learningPlan) return;

        const packages = this.progress.learningPlan.packages || [];
        const packagesCompleted = 0; // TODO: Implement package completion tracking
        
        if (packagesCompleted === packages.length && packages.length > 0) {
            packagesProgress.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>${packagesCompleted}/${packages.length}`;
            packagesProgress.className = 'badge bg-success ms-auto';
        } else if (packagesCompleted > 0) {
            packagesProgress.innerHTML = `<i class="bi bi-clock-fill me-1"></i>${packagesCompleted}/${packages.length}`;
            packagesProgress.className = 'badge bg-warning ms-auto';
        } else {
            packagesProgress.textContent = `${packagesCompleted}/${packages.length}`;
            packagesProgress.className = 'badge bg-secondary ms-auto';
        }
    }

    updateNavigation() {
        // Update navigation based on current state and progress
        if (!this.progress.learningPlan) return;

        // Enable/disable navigation items based on progress
        const basicsNav = document.querySelector('#onboarding-nav a[data-step="learn-basics"]');
        const packagesNav = document.querySelector('#onboarding-nav a[data-step="learn-packages"]');
        const completionNav = document.querySelector('#onboarding-nav a[data-step="completion"]');

        if (basicsNav) {
            basicsNav.classList.remove('disabled');
            // Add checkmark if basics are completed
            const basicChallenges = this.progress.learningPlan.basicChallenges || [];
            const completedBasics = this.progress.completedChallenges ? 
                this.progress.completedChallenges.filter(id => basicChallenges.includes(id)).length : 0;
            
            if (completedBasics === basicChallenges.length && basicChallenges.length > 0) {
                if (!basicsNav.querySelector('.bi-check-circle-fill')) {
                    basicsNav.innerHTML = '<i class="bi bi-check-circle-fill me-2 text-success"></i>Learn Basics';
                }
            }
        }

        // Enable packages section if some basics are completed
        const completedBasics = this.progress.completedChallenges ? 
            this.progress.completedChallenges.filter(id => 
                this.progress.learningPlan.basicChallenges.includes(id)).length : 0;
        
        if (packagesNav) {
            if (completedBasics >= 3) {
                packagesNav.classList.remove('disabled');
            } else {
                packagesNav.classList.add('disabled');
            }
        }

        // Enable completion if all challenges are done
        const totalCompleted = this.progress.completedChallenges ? this.progress.completedChallenges.length : 0;
        if (completionNav) {
            if (totalCompleted >= this.progress.learningPlan.totalChallenges) {
                completionNav.classList.remove('disabled');
                completionNav.innerHTML = '<i class="bi bi-trophy me-2 text-warning"></i>Completion';
                const completionStatus = document.getElementById('completion-status');
                if (completionStatus) {
                    completionStatus.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Complete!';
                    completionStatus.className = 'badge bg-success ms-auto';
                }
            } else {
                completionNav.classList.add('disabled');
                const completionStatus = document.getElementById('completion-status');
                if (completionStatus) {
                    completionStatus.textContent = 'Locked';
                    completionStatus.className = 'badge bg-secondary ms-auto';
                }
            }
        }
    }

    showSection(section) {
        document.querySelectorAll('.onboarding-section').forEach(s => s.style.display = 'none');
        
        const targetSection = document.getElementById(section + '-section');
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        document.querySelectorAll('#onboarding-nav a').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`#onboarding-nav a[data-step="${section}"]`)?.classList.add('active');

        this.currentStep = section;
    }

    getBasicChallengeProgress() {
        const total = this.selectedBasicChallenges.length;
        const completed = this.getCompletedChallenges().filter(id => 
            this.selectedBasicChallenges.includes(id)
        ).length;
        return { completed, total };
    }

    getPackageProgress() {
        const total = this.selectedPackages.length;
        // This would need to be implemented based on package completion tracking
        const completed = 0; // Placeholder
        return { completed, total };
    }

    getCompletedChallenges() {
        return this.progress.completedChallenges || [];
    }

    isOnboardingComplete() {
        const basicProgress = this.getBasicChallengeProgress();
        const packageProgress = this.getPackageProgress();
        return basicProgress.completed === basicProgress.total && 
               packageProgress.completed === packageProgress.total &&
               basicProgress.total > 0 && packageProgress.total > 0;
    }

    showToast(title, message, type = 'info') {
        const toast = document.getElementById('statusToast');
        const toastTitle = document.getElementById('toast-title');
        const toastMessage = document.getElementById('toast-message');
        
        if (toast && toastTitle && toastMessage) {
            toastTitle.textContent = title;
            toastMessage.textContent = message;
            
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }
    }

    getUsername() {
        // Try to get username from cookie first
        const getCookie = (name) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
        };
        
        return getCookie('username') || 'anonymous';
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem(this.getStorageKey('progress'));
            return saved ? JSON.parse(saved) : {
                startTime: Date.now(),
                basics: [],
                packages: [],
                currentStep: 'overview',
                completedChallenges: [],
                sessionId: this.sessionId
            };
        } catch (error) {
            return {
                startTime: Date.now(),
                basics: [],
                packages: [],
                currentStep: 'overview',
                completedChallenges: [],
                sessionId: this.sessionId
            };
        }
    }

    saveProgress() {
        try {
            this.progress.sessionId = this.sessionId;
            this.progress.lastUpdated = Date.now();
            localStorage.setItem(this.getStorageKey('progress'), JSON.stringify(this.progress));
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }

    saveEditorContent() {
        if (!this.editor || !this.currentChallenge) return;
        
        try {
            const code = this.editor.getValue();
            const key = this.getStorageKey(`challenge_${this.currentChallenge.id}_code`);
            localStorage.setItem(key, code);
            this.showSaveIndicator('saved');
            this.lastSaveTime = Date.now();
            console.log('Auto-saved code for challenge', this.currentChallenge.id);
        } catch (error) {
            console.error('Error saving editor content:', error);
            this.showSaveIndicator('error');
        }
    }

    loadEditorContent() {
        if (!this.currentChallenge) return null;
        
        try {
            const key = this.getStorageKey(`challenge_${this.currentChallenge.id}_code`);
            return localStorage.getItem(key);
        } catch (error) {
            console.error('Error loading editor content:', error);
            return null;
        }
    }

    initializeEditorButtons() {
        // Initialize tooltips for all buttons with data-bs-toggle="tooltip"
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl, {
                delay: { show: 300, hide: 100 },
                trigger: 'hover focus'
            });
        });

        // Initialize fullscreen button
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        // Initialize reset button
        const resetBtn = document.getElementById('reset-editor-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetEditor();
            });
        }
    }

    toggleFullscreen() {
        const editorWrapper = document.querySelector('.editor-wrapper');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const icon = fullscreenBtn.querySelector('i');
        const tooltip = bootstrap.Tooltip.getInstance(fullscreenBtn);
        
        if (!editorWrapper.classList.contains('editor-fullscreen')) {
            // Enter fullscreen mode
            editorWrapper.classList.add('editor-fullscreen');
            icon.className = 'bi bi-fullscreen-exit';
            fullscreenBtn.setAttribute('data-bs-original-title', 'Exit fullscreen mode (ESC)');
            
            // Update tooltip
            if (tooltip) {
                tooltip.dispose();
                new bootstrap.Tooltip(fullscreenBtn, { 
                    title: 'Exit fullscreen mode (ESC)',
                    delay: { show: 300, hide: 100 },
                    trigger: 'hover focus'
                });
            }
            
            // Resize editor to fit fullscreen
            setTimeout(() => {
                if (this.editor) {
                    this.editor.resize();
                }
            }, 100);
            
            // Add escape key listener
            document.addEventListener('keydown', this.handleEscapeKey.bind(this));
        } else {
            // Exit fullscreen mode
            this.exitFullscreen();
        }
    }

    exitFullscreen() {
        const editorWrapper = document.querySelector('.editor-wrapper');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const icon = fullscreenBtn.querySelector('i');
        const tooltip = bootstrap.Tooltip.getInstance(fullscreenBtn);
        
        editorWrapper.classList.remove('editor-fullscreen');
        icon.className = 'bi bi-arrows-fullscreen';
        fullscreenBtn.setAttribute('data-bs-original-title', 'Enter fullscreen mode (ESC to exit)');
        
        // Update tooltip
        if (tooltip) {
            tooltip.dispose();
            new bootstrap.Tooltip(fullscreenBtn, { 
                title: 'Enter fullscreen mode (ESC to exit)',
                delay: { show: 300, hide: 100 },
                trigger: 'hover focus'
            });
        }
        
        // Resize editor back to normal
        setTimeout(() => {
            if (this.editor) {
                this.editor.resize();
            }
        }, 100);
        
        // Remove escape key listener
        document.removeEventListener('keydown', this.handleEscapeKey.bind(this));
    }

    handleEscapeKey(event) {
        if (event.key === 'Escape') {
            this.exitFullscreen();
        }
    }

    resetEditor() {
        if (!this.currentChallenge || !this.editor) {
            this.showToast('Error', 'Editor not available', 'error');
            return;
        }

        // Show template preview in modal
        const template = this.currentChallenge.template || 
            '// Write your solution here\npackage main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}';
        
        const templatePreview = document.getElementById('template-preview');
        if (templatePreview) {
            templatePreview.textContent = template;
        }

        // Show the modal
        const resetModal = new bootstrap.Modal(document.getElementById('resetModal'));
        resetModal.show();

        // Set up the confirm button event (remove any existing listeners first)
        const confirmBtn = document.getElementById('confirmResetBtn');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            this.performReset(resetModal, template);
        });
    }

    performReset(modal, template) {
        const confirmText = document.getElementById('confirm-reset-text');
        const confirmSpinner = document.getElementById('confirm-reset-spinner');
        const confirmBtn = document.getElementById('confirmResetBtn');
        
        // Show loading state
        confirmText.classList.add('d-none');
        confirmSpinner.classList.remove('d-none');
        confirmBtn.disabled = true;
        
        // Simulate reset process with delay for better UX
        setTimeout(() => {
            // Clear saved code from localStorage
            try {
                const key = this.getStorageKey(`challenge_${this.currentChallenge.id}_code`);
                localStorage.removeItem(key);
            } catch (error) {
                console.error('Error clearing saved code:', error);
            }
            
            // Reset to template
            this.editor.setValue(template);
            this.editor.clearSelection();
            
            // Reset flags
            this.userHasTyped = false;
            this.pendingSave = false;
            
            // Hide save indicators
            this.showSaveIndicator(null);
            
            // Hide modal
            modal.hide();
            
            // Reset button states
            confirmText.classList.remove('d-none');
            confirmSpinner.classList.add('d-none');
            confirmBtn.disabled = false;
            
            // Show success message
            setTimeout(() => {
                this.showToast('Success', 'Code successfully reset to original template', 'success');
            }, 200);
        }, 800); // Small delay for better UX feedback
    }

    showSaveIndicator(status) {
        const saveIndicator = document.getElementById('save-indicator');
        const savingIndicator = document.getElementById('saving-indicator');
        
        if (!saveIndicator || !savingIndicator) return;

        // Hide both first
        saveIndicator.classList.add('d-none');
        savingIndicator.classList.add('d-none');

        if (status === 'saving') {
            savingIndicator.classList.remove('d-none');
        } else if (status === 'saved') {
            saveIndicator.classList.remove('d-none');
            // Hide after 2 seconds
            setTimeout(() => {
                saveIndicator.classList.add('d-none');
            }, 2000);
        } else if (status === 'error') {
            // Show error briefly
            saveIndicator.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Error';
            saveIndicator.className = 'badge bg-danger';
            saveIndicator.classList.remove('d-none');
            setTimeout(() => {
                saveIndicator.innerHTML = '<i class="bi bi-check2"></i> Saved';
                saveIndicator.className = 'badge bg-success d-none';
            }, 2000);
        }
    }

    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        // Auto-save every 3 seconds when editor content changes
        this.autoSaveTimer = setInterval(() => {
            if (this.editor && this.currentChallenge && this.pendingSave) {
                const now = Date.now();
                // Only save if it's been more than 2 seconds since last save and user has typed
                if (now - this.lastSaveTime > 2000 && this.userHasTyped) {
                    this.showSaveIndicator('saving');
                    setTimeout(() => {
                        this.saveEditorContent();
                        this.pendingSave = false; // Reset pending save flag
                    }, 500);
                }
            }
        }, 3000);
    }

    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    checkExistingProgress() {
        if (this.progress.learningPlan && this.progress.learningPlan.basicChallenges) {
            this.showProgressResume();
        }
    }

    showProgressResume() {
        const overviewSection = document.getElementById('overview-section');
        if (!overviewSection) return;

        // Calculate progress statistics
        const totalChallenges = this.progress.learningPlan.totalChallenges || 0;
        const completedCount = this.progress.completedChallenges ? this.progress.completedChallenges.length : 0;
        const progressPercent = totalChallenges > 0 ? Math.round((completedCount / totalChallenges) * 100) : 0;

        // Create progress resume section with improved design
        const progressDiv = document.createElement('div');
        progressDiv.className = 'card border-success mb-4 shadow-sm';
        progressDiv.innerHTML = `
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-9">
                        <div class="d-flex align-items-center mb-3">
                            <div class="bg-success bg-opacity-10 rounded-circle p-2 me-3">
                                <i class="bi bi-clock-history text-success" style="font-size: 1.2rem;"></i>
                            </div>
                            <div>
                                <h5 class="card-title mb-1">Welcome Back!</h5>
                                <p class="text-muted mb-0 small">Ready to continue your learning journey?</p>
                            </div>
                        </div>
                        
                        <div class="progress mb-3" style="height: 12px;">
                            <div class="progress-bar bg-gradient bg-success" role="progressbar" 
                                 style="width: ${progressPercent}%" 
                                 aria-valuenow="${progressPercent}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                                <small class="text-white fw-bold">${progressPercent}%</small>
                            </div>
                        </div>
                        
                        <div class="d-flex flex-wrap gap-2 mb-0">
                            <span class="badge bg-primary px-3 py-2">
                                <i class="bi bi-check-circle me-1"></i>${completedCount}/${totalChallenges} completed
                            </span>
                            <span class="badge bg-info px-3 py-2">
                                <i class="bi bi-code-square me-1"></i>${this.progress.learningPlan.basicChallenges.length} basic
                            </span>
                            <span class="badge bg-success px-3 py-2">
                                <i class="bi bi-box me-1"></i>${this.progress.learningPlan.packages.length} packages
                            </span>
                        </div>
                    </div>
                    <div class="col-md-3 text-center">
                        <div class="d-grid gap-2">
                            <button class="btn btn-success" onclick="window.companyOnboarding.resumeProgress()">
                                <i class="bi bi-play-circle-fill me-2"></i>Continue
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="window.companyOnboarding.resetProgress()">
                                <i class="bi bi-arrow-clockwise me-1"></i>Start Over
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert at the beginning of the overview section
        const heroSection = overviewSection.querySelector('.hero-section');
        if (heroSection) {
            heroSection.parentNode.insertBefore(progressDiv, heroSection.nextSibling);
        }
    }

    resumeProgress() {
        // Restore learning plan
        this.selectedBasicChallenges = this.progress.learningPlan.basicChallenges || [];
        this.selectedPackages = this.progress.learningPlan.packages || [];
        this.learningPlan = this.progress.learningPlan;
        
        // Calculate current challenge index
        this.currentChallengeIndex = this.progress.completedChallenges ? this.progress.completedChallenges.length : 0;
        
        // Start the session
        document.getElementById('onboarding-overview').style.display = 'none';
        document.getElementById('onboarding-session').style.display = 'block';
        this.loadCurrentChallenge();
        this.updateSessionMeta();
        
        this.showToast('Session Resumed', 'Continuing from where you left off!', 'success');
    }
}

// Global functions
function startOnboardingSetup() {
    const modal = new bootstrap.Modal(document.getElementById('setupModal'));
    modal.show();
}

function showSection(section) {
    if (window.companyOnboarding) {
        window.companyOnboarding.showSection(section);
    }
}

// Chat functionality for AI Mentor
class AIMentorChat {
    constructor(onboarding) {
        this.onboarding = onboarding;
        this.conversationHistory = [];
        this.isTyping = false;
        this.storageKey = 'ai-mentor-chat-history';
        this.setupEventListeners();
        this.loadChatHistory();
    }

    setupEventListeners() {
        // Chat mode toggle
        const quickModeRadio = document.getElementById('quick-mode');
        const chatModeRadio = document.getElementById('chat-mode');
        
        if (quickModeRadio && chatModeRadio) {
            quickModeRadio.addEventListener('change', () => this.toggleChatMode(false));
            chatModeRadio.addEventListener('change', () => this.toggleChatMode(true));
        }

        // Chat input
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }
    }

    toggleChatMode(isChatMode) {
        const quickActionsMode = document.getElementById('quick-actions-mode');
        const chatModeInterface = document.getElementById('chat-mode-interface');
        const aiStatusArea = document.getElementById('ai-status-area');

        if (quickActionsMode && chatModeInterface && aiStatusArea) {
            if (isChatMode) {
                quickActionsMode.style.display = 'none';
                chatModeInterface.style.display = 'block';
                aiStatusArea.style.display = 'none';
                
                // Focus chat input
                const chatInput = document.getElementById('chat-input');
                if (chatInput) {
                    setTimeout(() => chatInput.focus(), 100);
                }
            } else {
                quickActionsMode.style.display = 'block';
                chatModeInterface.style.display = 'none';
                aiStatusArea.style.display = 'block';
            }
        }
    }

    async sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (!message || this.isTyping) return;

        // Clear input immediately
        chatInput.value = '';

        // Add user message to chat
        this.addMessageToChat('user', message, true);

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Get current code context if available
            const codeContext = this.getCurrentCodeContext();
            
            // Show user if code is being included
            if (codeContext) {
                console.log('Including code context in chat:', codeContext.substring(0, 100) + '...');
                // Add a subtle indicator that code is being shared
                this.addCodeContextIndicator();
            }
            
            // Prepare request
            const requestData = {
                message: message,
                challengeId: this.onboarding.currentChallenge?.id || 0,
                conversationHistory: this.conversationHistory,
                codeContext: codeContext
            };

            const response = await fetch('/api/ai/mentor-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const chatResponse = await response.json();
            
            // Remove typing indicator
            this.removeTypingIndicator();
            
            if (chatResponse.success) {
                // Add AI response to chat
                this.addMessageToChat('assistant', chatResponse.message);
                
                // Update conversation history
                this.conversationHistory.push(
                    { role: 'user', content: message, timestamp: new Date().toISOString() },
                    { role: 'assistant', content: chatResponse.message, timestamp: chatResponse.timestamp }
                );
                
                // Limit history to last 20 messages (increased for better context)
                if (this.conversationHistory.length > 20) {
                    this.conversationHistory = this.conversationHistory.slice(-20);
                }
                
                // Save to localStorage
                this.saveChatHistory();
                
                // Show suggestions if available
                if (chatResponse.suggestions && chatResponse.suggestions.length > 0) {
                    this.showSuggestions(chatResponse.suggestions);
                }
            } else {
                this.addMessageToChat('assistant', chatResponse.message || 'Sorry, I encountered an error. Please try again.');
            }
            
        } catch (error) {
            console.error('Chat error:', error);
            this.removeTypingIndicator();
            this.addMessageToChat('assistant', 'I\'m having trouble connecting right now. Please try again in a moment.');
        }
    }

    sendQuickPrompt(prompt) {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.value = prompt;
            this.sendChatMessage();
        }
    }

    addMessageToChat(role, content, shouldSave = true) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        
        if (role === 'assistant') {
            bubbleDiv.innerHTML = `
                <div class="d-flex align-items-center mb-2">
                    <i class="bi bi-robot me-2 text-primary"></i>
                    <strong>AI Mentor</strong>
                </div>
                <div class="message-content">${this.formatMessageContent(content)}</div>
            `;
        } else {
            bubbleDiv.innerHTML = `<div class="message-content">${this.escapeHtml(content)}</div>`;
        }
        
        messageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(messageDiv);
        
        // Apply syntax highlighting to any code blocks in the new message
        if (role === 'assistant') {
            setTimeout(() => {
                messageDiv.querySelectorAll('pre code').forEach((el) => {
                    if (typeof hljs !== 'undefined') {
                        hljs.highlightElement(el);
                    }
                });
            }, 100);
        }
        
        // Auto-save chat history if requested
        if (shouldSave) {
            setTimeout(() => this.saveChatHistory(), 500);
        }
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showTypingIndicator() {
        this.isTyping = true;
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message ai typing-message';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <i class="bi bi-robot me-2 text-primary"></i>
                AI Mentor is typing<span class="typing-dots">...</span>
            </div>
        `;
        
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    removeTypingIndicator() {
        this.isTyping = false;
        const typingMessage = document.querySelector('.typing-message');
        if (typingMessage) {
            typingMessage.remove();
        }
    }

    showSuggestions(suggestions) {
        const quickPrompts = document.querySelector('.quick-prompts .d-flex');
        if (!quickPrompts) return;

        // Clear existing suggestions
        quickPrompts.innerHTML = '';
        
        // Add new suggestions
        suggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.className = 'btn btn-sm btn-outline-secondary';
            button.textContent = suggestion;
            button.onclick = () => this.sendQuickPrompt(suggestion);
            quickPrompts.appendChild(button);
        });
    }

    getCurrentCodeContext() {
        console.log('🔍 Attempting to get code context...');
        
        // Try to get current code from the editor
        // First try to get it from the onboarding instance
        if (this.onboarding && this.onboarding.editor && typeof this.onboarding.editor.getValue === 'function') {
            console.log('✅ Found editor in onboarding instance');
            const code = this.onboarding.editor.getValue();
            console.log('📝 Code length:', code.length, 'characters');
            return code.trim() !== '' ? code : null;
        }
        
        // Fallback to global window.editor
        if (window.editor && typeof window.editor.getValue === 'function') {
            console.log('✅ Found global window.editor');
            const code = window.editor.getValue();
            console.log('📝 Code length:', code.length, 'characters');
            return code.trim() !== '' ? code : null;
        }
        
        // Last resort: try to find editor in the global company onboarding instance
        if (window.companyOnboarding && window.companyOnboarding.editor && typeof window.companyOnboarding.editor.getValue === 'function') {
            console.log('✅ Found editor in global companyOnboarding');
            const code = window.companyOnboarding.editor.getValue();
            console.log('📝 Code length:', code.length, 'characters');
            return code.trim() !== '' ? code : null;
        }
        
        console.log('❌ No editor found');
        console.log('Debug info:', {
            'this.onboarding': !!this.onboarding,
            'this.onboarding.editor': !!(this.onboarding && this.onboarding.editor),
            'window.editor': !!window.editor,
            'window.companyOnboarding': !!window.companyOnboarding,
            'window.companyOnboarding.editor': !!(window.companyOnboarding && window.companyOnboarding.editor)
        });
        
        return null;
    }

    formatMessageContent(content) {
        // Basic markdown-like formatting for AI responses
        let formatted = this.escapeHtml(content);
        
        // Format Go code blocks (using same style as rest of app)
        formatted = formatted.replace(/```go\n([\s\S]*?)\n```/g, (match, code) => {
            return `<pre class="bg-light p-3 rounded"><code class="language-go">${code.trim()}</code></pre>`;
        });
        
        // Format generic code blocks  
        formatted = formatted.replace(/```([a-zA-Z]*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
            const language = lang || 'text';
            return `<pre class="bg-light p-3 rounded"><code class="language-${language}">${code.trim()}</code></pre>`;
        });
        
        // Format code blocks without language specifier
        formatted = formatted.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre class="bg-light p-3 rounded"><code>${code.trim()}</code></pre>`;
        });
        
        // Format inline code (match app style)
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-light px-2 py-1 rounded">$1</code>');
        
        // Format bold text
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Format italic text
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Format line breaks (but not inside code blocks)
        formatted = formatted.replace(/\n(?![^<]*<\/(?:pre|code)>)/g, '<br>');
        
        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    addCodeContextIndicator() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        // Add a small indicator that code context is being shared
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'text-center my-2';
        indicatorDiv.innerHTML = `
            <small class="text-muted">
                <i class="bi bi-code-square me-1"></i>
                <em>Sharing your current code with AI Mentor...</em>
            </small>
        `;
        
        chatMessages.appendChild(indicatorDiv);
        
        // Remove the indicator after 2 seconds
        setTimeout(() => {
            if (indicatorDiv.parentNode) {
                indicatorDiv.remove();
            }
        }, 2000);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    saveChatHistory() {
        try {
            const historyData = {
                conversationHistory: this.conversationHistory,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(historyData));
        } catch (error) {
            console.warn('Failed to save chat history:', error);
        }
    }

    loadChatHistory() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const historyData = JSON.parse(saved);
                this.conversationHistory = historyData.conversationHistory || [];
                
                // Restore chat messages from conversation history
                if (this.conversationHistory.length > 0) {
                    const chatMessages = document.getElementById('chat-messages');
                    if (chatMessages) {
                        // Clear existing messages except welcome message
                        const welcomeMessage = chatMessages.querySelector('.chat-message.ai');
                        chatMessages.innerHTML = '';
                        if (welcomeMessage) {
                            chatMessages.appendChild(welcomeMessage);
                        }
                        
                        // Recreate messages from conversation history
                        this.conversationHistory.forEach(msg => {
                            this.addMessageToChat(msg.role, msg.content, false); // false = don't save again
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to load chat history:', error);
            this.conversationHistory = [];
        }
    }

    clearChatHistoryWithConfirmation() {
        const messageCount = this.conversationHistory.length;
        if (messageCount === 0) {
            this.showTemporaryMessage('Chat is already empty', 'info');
            return;
        }
        
        const confirmMessage = `Are you sure you want to clear your chat history? This will delete ${Math.floor(messageCount/2)} conversation turns and cannot be undone.`;
            
        if (confirm(confirmMessage)) {
            this.clearChatHistory();
            this.showTemporaryMessage('Chat history cleared', 'success');
        }
    }

    clearChatHistory() {
        // Clear localStorage
        localStorage.removeItem(this.storageKey);
        
        // Clear in-memory history
        this.conversationHistory = [];
        
        // Clear chat messages UI
        this.clearChat();
    }

    showTemporaryMessage(message, type = 'info') {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'text-center my-2';
        messageDiv.innerHTML = `
            <small class="text-${type === 'success' ? 'success' : 'info'}">
                <i class="bi bi-${type === 'success' ? 'check-circle' : 'info-circle'} me-1"></i>
                ${message}
            </small>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }

    clearChat() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            // Keep only the welcome message
            const welcomeMessage = chatMessages.querySelector('.chat-message.ai');
            chatMessages.innerHTML = '';
            if (welcomeMessage) {
                chatMessages.appendChild(welcomeMessage);
            }
        }
        this.conversationHistory = [];
    }
}

// Global functions for compatibility
function sendChatMessage() {
    if (window.companyOnboarding && window.companyOnboarding.aiChat) {
        window.companyOnboarding.aiChat.sendChatMessage();
    }
}

function sendQuickPrompt(prompt) {
    if (window.companyOnboarding && window.companyOnboarding.aiChat) {
        window.companyOnboarding.aiChat.sendQuickPrompt(prompt);
    }
}

function openAIMentorChat() {
    // Switch to AI mentor tab and enable chat mode
    const aiTab = document.getElementById('ai-tab');
    const chatModeRadio = document.getElementById('chat-mode');
    
    if (aiTab) {
        aiTab.click();
    }
    
    setTimeout(() => {
        if (chatModeRadio) {
            chatModeRadio.checked = true;
            chatModeRadio.dispatchEvent(new Event('change'));
        }
    }, 100);
}

function clearChatHistory() {
    if (window.companyOnboarding && window.companyOnboarding.aiChat) {
        window.companyOnboarding.aiChat.clearChatHistoryWithConfirmation();
    }
}

// Debug function to clear corrupted localStorage data
function debugClearChatStorage() {
    localStorage.removeItem('ai-mentor-chat-history');
    console.log('Chat storage cleared. Please refresh the page.');
}

// Test function for code formatting (can be removed in production)
function testCodeFormatting() {
    if (window.companyOnboarding && window.companyOnboarding.aiChat) {
        const testCode = `func ReverseString(s string) string {
    runes := []rune(s)
    for i, j := 0, len(runes) - 1; i < j; i, j = i + 1, j - 1 {
        runes[i], runes[j] = runes[j], runes[i]
    }
    return string(runes)
}`;
        
        const testMessage = `Here's an example function:

\`\`\`go
${testCode}
\`\`\`

This function reverses a string by converting it to runes.`;
        
        // Test the actual message addition to see highlight.js integration
        window.companyOnboarding.aiChat.addMessageToChat('assistant', testMessage);
        console.log('Added test message with code formatting to chat');
        return true;
    }
    return null;
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    window.companyOnboarding = new CompanyOnboarding();
    
    // Initialize AI chat when onboarding is ready
    setTimeout(() => {
        if (window.companyOnboarding) {
            window.companyOnboarding.aiChat = new AIMentorChat(window.companyOnboarding);
        }
    }, 100);
});