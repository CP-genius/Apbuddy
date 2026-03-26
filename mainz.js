// =============================================
// FIREBASE IMPORTS
// =============================================

import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    addDoc,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const auth = window.firebaseAuth;
const db = window.firebaseDB;
const provider = new GoogleAuthProvider();

// =============================================
// APP STATE
// =============================================

const state = {
    user: null,
    isPremium: false,
    currentPage: 'loading',
    selectedSubject: null,
    selectedQuizType: 'random',
    selectedTopic: null,
    quizSetup: null,
    currentQuiz: null,
    currentQuestionIndex: 0,
    userAnswers: {},
    quizTimeLimit: 0,
    timeRemaining: 0,
    timerInterval: null,
    questions: [],
    quizData: { random: {}, topic: {} },
    pendingQuiz: null
};

let subjects = [];

// =============================================
// DOM ELEMENTS
// =============================================

const loadingScreen = document.getElementById('loadingScreen');
const waveProgress = document.getElementById('waveProgress');
const continueBtn = document.getElementById('continueBtn');
const authContainer = document.getElementById('authContainer');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const mainHeader = document.getElementById('mainHeader');
const homeNavBtn = document.getElementById('homeNavBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');
const userTier = document.getElementById('userTier');
const homePage = document.getElementById('homePage');
const subjectSelectionPage = document.getElementById('subjectSelectionPage');
const quizTypePage = document.getElementById('quizTypePage');
const topicQuizPage = document.getElementById('topicQuizPage');
const quizScreen = document.getElementById('quizScreen');
const takeQuizBtn = document.getElementById('takeQuizBtn');
const subjectSearchInput = document.getElementById('subjectSearchInput');
const subjectList = document.getElementById('subjectList');
const backToSubjectBtn = document.getElementById('backToSubjectBtn');
const quizTypeSubject = document.getElementById('quizTypeSubject');
const quizTypeSelect = document.getElementById('quizTypeSelect');
const randomQuizGrid = document.getElementById('randomQuizGrid');
const topicGrid = document.getElementById('topicGrid');
const noTopicsMessage = document.getElementById('noTopicsMessage');
const backToTopicsBtn = document.getElementById('backToTopicsBtn');
const topicTitle = document.getElementById('topicTitle');
const topicQuizGrid = document.getElementById('topicQuizGrid');
const quizSubjectTitle = document.getElementById('quizSubjectTitle');
const quizTimer = document.getElementById('quizTimer');
const questionGrid = document.getElementById('questionGrid');
const questionNumber = document.getElementById('questionNumber');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const setupModal = document.getElementById('setupModal');
const selectedQuizLabel = document.getElementById('selectedQuizLabel');
const durationSelect = document.getElementById('durationSelect');
const quizSetupForm = document.getElementById('quizSetupForm');
const closeSetupModal = document.getElementById('closeSetupModal');
const upgradeModal = document.getElementById('upgradeModal');
const closeUpgradeModal = document.getElementById('closeUpgradeModal');
const upgradeNowBtn = document.getElementById('upgradeNowBtn');
const paymentModal = document.getElementById('paymentModal');
const closePaymentModal = document.getElementById('closePaymentModal');
const uniqueCodeInput = document.getElementById('uniqueCodeInput');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const paymentSentBtn = document.getElementById('paymentSentBtn');
const explanationModal = document.getElementById('explanationModal');
const closeExplanationModal = document.getElementById('closeExplanationModal');
const explanationTitle = document.getElementById('explanationTitle');
const resultIcon = document.getElementById('resultIcon');
const resultText = document.getElementById('resultText');
const explanationText = document.getElementById('explanationText');
const continueQuizBtn = document.getElementById('continueQuizBtn');
const resultsModal = document.getElementById('resultsModal');
const scorePercentage = document.getElementById('scorePercentage');
const correctCountSpan = document.getElementById('correctCount');
const totalQuestionsSpan = document.getElementById('totalQuestions');
const closeResultsModal = document.getElementById('closeResultsModal');
const backToQuizzesBtn = document.getElementById('backToQuizzesBtn');
const goHomeBtn = document.getElementById('goHomeBtn');
const correctToast = document.getElementById('correctToast');
const incorrectToast = document.getElementById('incorrectToast');
const unansweredToast = document.getElementById('unansweredToast');

// =============================================
// AUTHENTICATION
// =============================================

async function checkUserAuth() {
    console.log("🔐 Checking authentication...");
    await loadSubjects();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("✅ User signed in:", user.email);
            state.user = user;
            await checkUserPremiumStatus(user.uid);
            updateUserBadge();
            authContainer.style.display = 'none';
            continueBtn.classList.remove('hidden');
            continueBtn.style.display = 'flex';
            logoutBtn.classList.remove('hidden');
            await loadAllQuizData();
        } else {
            console.log("❌ User not signed in");
            state.user = null;
            state.isPremium = false;
            userName.textContent = "Guest";
            userTier.textContent = "FREE";
            userTier.className = "badge free";
            logoutBtn.classList.add('hidden');
            authContainer.style.display = 'flex';
            continueBtn.classList.add('hidden');
            await loadFreeQuizData();
        }
        if (subjectSelectionPage && !subjectSelectionPage.classList.contains('hidden')) {
            populateSubjectList();
        }
    });
}

async function checkUserPremiumStatus(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            state.isPremium = userDoc.data().isPremium || false;
        } else {
            await setDoc(userRef, {
                email: state.user.email,
                name: state.user.displayName,
                isPremium: false,
                createdAt: new Date().toISOString()
            });
            state.isPremium = false;
        }
    } catch (error) {
        console.error("Error checking premium status:", error);
        state.isPremium = false;
    }
}

function updateUserBadge() {
    if (state.user) {
        userName.textContent = state.user.displayName || state.user.email.split('@')[0];
        if (state.isPremium) {
            userTier.textContent = "PREMIUM";
            userTier.className = "badge premium";
        } else {
            userTier.textContent = "FREE";
            userTier.className = "badge free";
        }
    } else {
        userName.textContent = "Guest";
        userTier.textContent = "FREE";
        userTier.className = "badge free";
    }
}

async function signInWithGoogle() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        showToast(incorrectToast, "Sign in failed. Please try again.");
    }
}

async function signOutUser() {
    try {
        await signOut(auth);
        showToast(correctToast, "Signed out successfully");
        state.user = null;
        state.isPremium = false;
        state.quizData = { random: {}, topic: {} };
        await loadFreeQuizData();
        goToHomePage();
    } catch (error) {
        console.error("❌ Sign out error:", error);
    }
}

// =============================================
// LOAD SUBJECTS - FIXED (No fallback)
// =============================================

async function loadSubjects() {
    try {
        const snapshot = await getDocs(collection(db, 'subjects'));
        
        if (!snapshot.empty) {
            subjects = snapshot.docs.map(doc => ({ 
                name: doc.id, 
                icon: doc.data().icon || 'fas fa-book' 
            }));
        } else {
            subjects = [];
        }
        
        // Refresh subject list if visible
        if (subjectSelectionPage && !subjectSelectionPage.classList.contains('hidden')) {
            populateSubjectList();
        }
    } catch (error) {
        console.error("Error loading subjects:", error);
        subjects = [];
    }
}

// =============================================
// LOAD QUIZ DATA
// =============================================

async function loadAllQuizData() {
    try {
        state.quizData = { random: {}, topic: {} };
        
        for (const subject of subjects) {
            const snapshot = await getDocs(collection(db, "subjects", subject.name, "quizzes"));
            state.quizData.random[subject.name] = {};
            state.quizData.topic[subject.name] = {};
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.type === 'topic') {
                    const topic = data.topic;
                    if (!state.quizData.topic[subject.name][topic]) {
                        state.quizData.topic[subject.name][topic] = {};
                    }
                    state.quizData.topic[subject.name][topic][doc.id] = data;
                } else {
                    state.quizData.random[subject.name][doc.id] = data;
                }
            });
        }
    } catch (error) {
        console.error("Error loading quiz data:", error);
        await loadFreeQuizData();
    }
}

async function loadFreeQuizData() {
    try {
        state.quizData = { random: {}, topic: {} };
        
        for (const subject of subjects) {
            const quizRef = doc(db, "subjects", subject.name, "quizzes", "quiz1");
            const quizDoc = await getDoc(quizRef);
            if (quizDoc.exists()) {
                state.quizData.random[subject.name] = { quiz1: quizDoc.data() };
            }
        }
    } catch (error) {
        console.error("Error loading free quiz data:", error);
    }
}

// =============================================
// QUIZ ACCESS
// =============================================

function canAccessQuiz(quizKey) {
    const quizNumber = parseInt(quizKey.replace('quiz', '').replace(/[^0-9]/g, ''));
    if (isNaN(quizNumber) || quizNumber === 1) return true;
    return state.isPremium;
}

function showUpgradeModal(quizKey, quizData) {
    state.pendingQuiz = { quizKey, data: quizData };
    openModal(upgradeModal);
}

// =============================================
// PAYMENT SYSTEM
// =============================================

function generateUniqueCode() {
    return `APB${Date.now()}${Math.floor(Math.random() * 10000)}`.slice(-16);
}

function showPaymentModal() {
    closeModal(upgradeModal);
    if (uniqueCodeInput) uniqueCodeInput.value = generateUniqueCode();
    openModal(paymentModal);
}

function copyUniqueCode() {
    if (uniqueCodeInput) {
        uniqueCodeInput.select();
        document.execCommand('copy');
        showToast(correctToast, "Code copied!");
    }
}

async function handlePaymentSent() {
    const uniqueCode = uniqueCodeInput ? uniqueCodeInput.value : '';
    if (!state.user?.uid) {
        showToast(incorrectToast, "Please login first");
        closeModal(paymentModal);
        return;
    }
    try {
        await addDoc(collection(db, 'payments'), {
            userId: state.user.uid,
            userEmail: state.user.email,
            userName: state.user.displayName,
            code: uniqueCode,
            amount: 100,
            status: 'pending',
            timestamp: new Date().toISOString()
        });
        closeModal(paymentModal);
        showToast(correctToast, "Payment request sent!");
        alert("Send ₦100 to: 1234567890 (Opay/Palmpay)\nUse code: " + uniqueCode + " in remark");
    } catch (error) {
        showToast(incorrectToast, "Error submitting payment");
    }
}

// =============================================
// APP INITIALIZATION
// =============================================

function initApp() {
    setTimeout(() => {
        if (waveProgress) waveProgress.classList.add('complete');
    }, 500);
    
    if (waveProgress) {
        waveProgress.addEventListener('transitionend', function() {
            waveProgress.style.display = 'none';
            const continueBtnEl = document.getElementById('continueBtn');
            if (continueBtnEl) {
                continueBtnEl.classList.remove('hidden');
                continueBtnEl.style.display = 'flex';
            }
            checkUserAuth();
        });
    }
    
    setupEventListeners();
}

function setupEventListeners() {
    if (googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if (logoutBtn) logoutBtn.addEventListener('click', signOutUser);
    if (continueBtn) continueBtn.addEventListener('click', handleContinue);
    if (homeNavBtn) homeNavBtn.addEventListener('click', goToHomePage);
    if (takeQuizBtn) takeQuizBtn.addEventListener('click', showSubjectSelectionPage);
    if (subjectSearchInput) subjectSearchInput.addEventListener('input', filterSubjects);
    if (backToSubjectBtn) backToSubjectBtn.addEventListener('click', goToSubjectSelectionPage);
    if (quizTypeSelect) quizTypeSelect.addEventListener('change', handleQuizTypeChange);
    if (backToTopicsBtn) backToTopicsBtn.addEventListener('click', goToQuizTypePage);
    if (closeSetupModal) closeSetupModal.addEventListener('click', () => closeModal(setupModal));
    if (quizSetupForm) quizSetupForm.addEventListener('submit', handleQuizSetup);
    if (closeUpgradeModal) closeUpgradeModal.addEventListener('click', () => closeModal(upgradeModal));
    if (upgradeNowBtn) upgradeNowBtn.addEventListener('click', showPaymentModal);
    if (closePaymentModal) closePaymentModal.addEventListener('click', () => closeModal(paymentModal));
    if (copyCodeBtn) copyCodeBtn.addEventListener('click', copyUniqueCode);
    if (paymentSentBtn) paymentSentBtn.addEventListener('click', handlePaymentSent);
    if (closeExplanationModal) closeExplanationModal.addEventListener('click', () => closeModal(explanationModal));
    if (continueQuizBtn) continueQuizBtn.addEventListener('click', handleContinueAfterExplanation);
    if (closeResultsModal) closeResultsModal.addEventListener('click', () => closeModal(resultsModal));
    if (backToQuizzesBtn) backToQuizzesBtn.addEventListener('click', () => {
        closeModal(resultsModal);
        state.selectedTopic ? goToTopicQuizPage() : goToQuizTypePage();
    });
    if (goHomeBtn) goHomeBtn.addEventListener('click', () => {
        closeModal(resultsModal);
        goToHomePage();
    });
    if (prevBtn) prevBtn.addEventListener('click', goToPreviousQuestion);
    if (nextBtn) nextBtn.addEventListener('click', goToNextQuestion);
    
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });
}

function handleContinue() {
    if (continueBtn) {
        continueBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        continueBtn.disabled = true;
    }
    setTimeout(() => {
        hideLoadingScreen();
        showHomePage();
        if (continueBtn) {
            continueBtn.innerHTML = '<i class="fas fa-play-circle"></i> Continue';
            continueBtn.disabled = false;
        }
    }, 1000);
}

function hideLoadingScreen() {
    if (loadingScreen) loadingScreen.style.opacity = '0';
    setTimeout(() => {
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (mainHeader) mainHeader.classList.remove('hidden');
    }, 500);
}

// =============================================
// PAGE NAVIGATION
// =============================================

function hideAllPages() {
    if (homePage) homePage.classList.add('hidden');
    if (subjectSelectionPage) subjectSelectionPage.classList.add('hidden');
    if (quizTypePage) quizTypePage.classList.add('hidden');
    if (topicQuizPage) topicQuizPage.classList.add('hidden');
    if (quizScreen) quizScreen.classList.add('hidden');
}

function showHomePage() {
    hideAllPages();
    if (homePage) homePage.classList.remove('hidden');
    state.currentPage = 'home';
}

function goToHomePage() {
    state.selectedSubject = null;
    state.selectedTopic = null;
    state.selectedQuizType = 'random';
    hideAllPages();
    if (homePage) homePage.classList.remove('hidden');
    state.currentPage = 'home';
}

function showSubjectSelectionPage() {
    hideAllPages();
    if (subjectSelectionPage) subjectSelectionPage.classList.remove('hidden');
    state.currentPage = 'subjectSelection';
    populateSubjectList();
}

function goToSubjectSelectionPage() {
    hideAllPages();
    if (subjectSelectionPage) subjectSelectionPage.classList.remove('hidden');
    state.currentPage = 'subjectSelection';
}

function showQuizTypePage() {
    hideAllPages();
    if (quizTypePage) quizTypePage.classList.remove('hidden');
    state.currentPage = 'quizType';
    if (quizTypeSubject) quizTypeSubject.textContent = state.selectedSubject;
    state.selectedTopic = null;
    handleQuizTypeChange();
}

function goToQuizTypePage() {
    hideAllPages();
    if (quizTypePage) quizTypePage.classList.remove('hidden');
    state.currentPage = 'quizType';
    state.selectedTopic = null;
}

function showTopicQuizPage() {
    hideAllPages();
    if (topicQuizPage) topicQuizPage.classList.remove('hidden');
    state.currentPage = 'topicQuiz';
    if (topicTitle) topicTitle.textContent = `${state.selectedSubject}: ${state.selectedTopic}`;
    loadTopicQuizzes();
}

function goToTopicQuizPage() {
    hideAllPages();
    if (topicQuizPage) topicQuizPage.classList.remove('hidden');
    state.currentPage = 'topicQuiz';
}

// =============================================
// SUBJECT MANAGEMENT
// =============================================

function populateSubjectList(filter = '') {
    if (!subjectList) return;
    subjectList.innerHTML = '';
    const filtered = subjects.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));
    filtered.forEach(subject => {
        const item = document.createElement('div');
        item.className = 'subject-item';
        item.innerHTML = `<i class="${subject.icon}"></i><div class="subject-name">${subject.name}</div>`;
        item.addEventListener('click', () => selectSubject(subject.name));
        subjectList.appendChild(item);
    });
    if (filtered.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'subject-item';
        noResults.innerHTML = '<div class="subject-name">No subjects found</div>';
        noResults.style.textAlign = 'center';
        noResults.style.color = 'var(--gray)';
        subjectList.appendChild(noResults);
    }
}

function filterSubjects() {
    if (subjectSearchInput) populateSubjectList(subjectSearchInput.value);
}

async function selectSubject(subject) {
    state.selectedSubject = subject;
    const hasTopics = state.quizData.topic[subject] && Object.keys(state.quizData.topic[subject]).length > 0;
    if (quizTypeSelect) {
        quizTypeSelect.innerHTML = hasTopics 
            ? '<option value="random">Random Quiz</option><option value="topic">Topic-Based Quiz</option>'
            : '<option value="random">Random Quiz</option><option value="topic" disabled>Topic-Based Quiz (Not Available)</option>';
    }
    showQuizTypePage();
}

// =============================================
// QUIZ TYPE MANAGEMENT
// =============================================

function handleQuizTypeChange() {
    if (!quizTypeSelect) return;
    state.selectedQuizType = quizTypeSelect.value;
    
    if (state.selectedQuizType === 'random') {
        if (topicGrid) topicGrid.classList.add('hidden');
        if (noTopicsMessage) noTopicsMessage.classList.add('hidden');
        if (randomQuizGrid) randomQuizGrid.classList.remove('hidden');
        loadRandomQuizzes();
    } else {
        if (randomQuizGrid) randomQuizGrid.classList.add('hidden');
        if (state.quizData.topic[state.selectedSubject] && Object.keys(state.quizData.topic[state.selectedSubject]).length) {
            if (topicGrid) topicGrid.classList.remove('hidden');
            if (noTopicsMessage) noTopicsMessage.classList.add('hidden');
            loadTopics();
        } else {
            if (topicGrid) topicGrid.classList.add('hidden');
            if (noTopicsMessage) noTopicsMessage.classList.remove('hidden');
        }
    }
}

function loadRandomQuizzes() {
    if (!randomQuizGrid) return;
    randomQuizGrid.innerHTML = '';
    const quizzes = state.quizData.random[state.selectedSubject];
    if (!quizzes || Object.keys(quizzes).length === 0) {
        randomQuizGrid.innerHTML = '<div class="quiz-card"><div class="quiz-card-header"><div class="quiz-subject">No Random Quizzes</div></div><div class="quiz-details">No quizzes available.</div></div>';
        return;
    }
    Object.entries(quizzes).forEach(([quizKey, quizData]) => {
        const qCount = quizData.questions?.length || 0;
        const isLocked = !canAccessQuiz(quizKey);
        const card = document.createElement('div');
        card.className = `quiz-card ${isLocked ? 'locked' : ''}`;
        card.innerHTML = `
            <div class="quiz-card-header"><div class="quiz-subject">${state.selectedSubject} - ${quizKey.toUpperCase()}</div>
            <div class="quiz-status">${isLocked ? '🔒 PREMIUM' : 'FREE'}</div></div>
            <div class="quiz-details">${qCount} questions</div>
            <div class="quiz-card-footer"><div class="quiz-questions">${qCount} questions</div>
            <button class="quiz-action">${isLocked ? 'Unlock Premium' : 'Start Quiz'}</button></div>`;
        const btn = card.querySelector('.quiz-action');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            isLocked ? showUpgradeModal(quizKey, quizData) : handleRandomQuizSelection(quizKey, quizData);
        });
        randomQuizGrid.appendChild(card);
    });
}

function loadTopics() {
    if (!topicGrid) return;
    topicGrid.innerHTML = '';
    const topics = state.quizData.topic[state.selectedSubject];
    Object.keys(topics).forEach(topicName => {
        const topicQuizzes = topics[topicName];
        let totalQuestions = 0;
        Object.values(topicQuizzes).forEach(quiz => { if (quiz.questions) totalQuestions += quiz.questions.length; });
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.innerHTML = `<i class="fas fa-folder topic-icon"></i><div class="topic-name">${topicName}</div><div class="topic-count">${Object.keys(topicQuizzes).length} quizzes • ${totalQuestions} questions</div>`;
        card.addEventListener('click', () => selectTopic(topicName));
        topicGrid.appendChild(card);
    });
}

function selectTopic(topic) {
    state.selectedTopic = topic;
    showTopicQuizPage();
}

function loadTopicQuizzes() {
    if (!topicQuizGrid) return;
    topicQuizGrid.innerHTML = '';
    const topicData = state.quizData.topic[state.selectedSubject]?.[state.selectedTopic];
    if (!topicData) {
        topicQuizGrid.innerHTML = '<div class="quiz-card"><div class="quiz-card-header"><div class="quiz-subject">No Quizzes Available</div></div></div>';
        return;
    }
    Object.entries(topicData).forEach(([quizId, quizData]) => {
        const qCount = quizData.questions?.length || 0;
        const quizName = quizData.quizName || quizId.split('_').pop() || quizId;
        const isLocked = !canAccessQuiz(quizName);
        const card = document.createElement('div');
        card.className = `quiz-card ${isLocked ? 'locked' : ''}`;
        card.innerHTML = `
            <div class="quiz-card-header"><div class="quiz-subject">${state.selectedTopic} - ${quizName.toUpperCase()}</div>
            <div class="quiz-status">${isLocked ? '🔒 PREMIUM' : 'FREE'}</div></div>
            <div class="quiz-details">${qCount} questions</div>
            <div class="quiz-card-footer"><div class="quiz-questions">${qCount} questions</div>
            <button class="quiz-action">${isLocked ? 'Unlock Premium' : 'Start Quiz'}</button></div>`;
        const btn = card.querySelector('.quiz-action');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            isLocked ? showUpgradeModal(quizId, quizData) : handleTopicQuizSelection(quizId, quizData);
        });
        topicQuizGrid.appendChild(card);
    });
}

function handleRandomQuizSelection(quizKey, quizData) {
    state.currentQuiz = { type: 'random', subject: state.selectedSubject, quizKey, data: quizData };
    showQuizSetupModal();
}

function handleTopicQuizSelection(quizId, quizData) {
    state.currentQuiz = { type: 'topic', subject: state.selectedSubject, topic: state.selectedTopic, quizId, data: quizData };
    showQuizSetupModal();
}

function showQuizSetupModal() {
    let label = '';
    if (state.currentQuiz.type === 'random') {
        label = `${state.currentQuiz.subject} - ${state.currentQuiz.quizKey.toUpperCase()}`;
    } else {
        label = `${state.currentQuiz.subject}: ${state.currentQuiz.topic} - ${(state.currentQuiz.data?.quizName || state.currentQuiz.quizId).toUpperCase()}`;
    }
    if (selectedQuizLabel) selectedQuizLabel.textContent = `Quiz: ${label}`;
    openModal(setupModal);
}

function handleQuizSetup(e) {
    e.preventDefault();
    const duration = durationSelect ? parseInt(durationSelect.value) : 0;
    state.quizSetup = { duration, timestamp: new Date().toISOString() };
    localStorage.setItem('aPlusBuddyQuizSetup', JSON.stringify(state.quizSetup));
    closeModal(setupModal);
    loadQuestionsForQuiz();
}

function loadQuestionsForQuiz() {
    if (state.currentQuiz?.data?.questions) {
        state.questions = state.currentQuiz.data.questions;
    } else {
        state.questions = [];
    }
    showQuizScreen();
}

function showQuizScreen() {
    hideAllPages();
    if (quizScreen) quizScreen.classList.remove('hidden');
    state.currentPage = 'quiz';
    initializeQuiz();
}

function initializeQuiz() {
    state.currentQuestionIndex = 0;
    state.userAnswers = {};
    let title = state.currentQuiz.type === 'random' ? state.currentQuiz.subject : `${state.currentQuiz.subject}: ${state.currentQuiz.topic}`;
    if (quizSubjectTitle) quizSubjectTitle.textContent = title;
    if (state.quizSetup?.duration > 0) {
        state.quizTimeLimit = state.quizSetup.duration * 60;
        state.timeRemaining = state.quizTimeLimit;
        startTimer();
    } else {
        if (quizTimer) quizTimer.textContent = "∞";
    }
    createQuestionGrid(state.questions.length);
    loadQuestion(0);
}

function createQuestionGrid(count) {
    if (!questionGrid) return;
    questionGrid.innerHTML = '';
    const displayCount = Math.min(count, 50);
    for (let i = 1; i <= displayCount; i++) {
        const box = document.createElement('div');
        box.className = 'question-box unanswered';
        box.textContent = i;
        box.dataset.questionIndex = i - 1;
        box.addEventListener('click', () => loadQuestion(parseInt(box.dataset.questionIndex)));
        questionGrid.appendChild(box);
    }
}

function loadQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;
    state.currentQuestionIndex = index;
    const q = state.questions[index];
    if (questionNumber) questionNumber.textContent = `Question ${index + 1} of ${state.questions.length}`;
    if (questionText) questionText.textContent = q.text;
    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        q.options.forEach((opt, optIdx) => {
            const optEl = document.createElement('div');
            optEl.className = `option ${state.userAnswers[index] === optIdx ? 'selected' : ''}`;
            optEl.innerHTML = `<span class="option-letter">${String.fromCharCode(65 + optIdx)}</span>${opt}`;
            optEl.addEventListener('click', () => selectOption(optIdx));
            optionsContainer.appendChild(optEl);
        });
    }
    updateQuestionGrid();
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.textContent = index === state.questions.length - 1 ? 'Finish' : 'Next';
}

function selectOption(optionIndex) {
    const idx = state.currentQuestionIndex;
    const q = state.questions[idx];
    if (state.userAnswers[idx] === optionIndex) {
        delete state.userAnswers[idx];
        closeModal(explanationModal);
    } else {
        state.userAnswers[idx] = optionIndex;
        const isCorrect = optionIndex === q.answer;
        showExplanationModal(isCorrect, q.explanation || 'No explanation', isCorrect ? null : q.options[q.answer]);
        showToast(isCorrect ? correctToast : incorrectToast, isCorrect ? "Correct!" : "Incorrect. Check explanation.");
    }
    loadQuestion(idx);
    updateQuestionGrid();
}

function showExplanationModal(isCorrect, explanation, correctAnswer) {
    if (explanationTitle) {
        explanationTitle.innerHTML = isCorrect ? '<i class="fas fa-check-circle"></i> Correct!' : '<i class="fas fa-times-circle"></i> Incorrect';
        explanationTitle.className = isCorrect ? 'modal-title correct' : 'modal-title incorrect';
    }
    if (resultIcon) {
        resultIcon.innerHTML = isCorrect ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-times-circle"></i>';
        resultIcon.className = isCorrect ? 'result-icon correct' : 'result-icon incorrect';
    }
    if (resultText) {
        if (isCorrect) {
            resultText.textContent = 'Excellent! Your answer is correct.';
        } else {
            resultText.textContent = 'Incorrect. Here\'s the right answer:';
            if (correctAnswer) explanation = `<strong>Correct Answer:</strong> ${correctAnswer}<br><br>${explanation}`;
        }
    }
    if (explanationText) explanationText.innerHTML = explanation;
    openModal(explanationModal);
}

function handleContinueAfterExplanation() {
    closeModal(explanationModal);
    state.currentQuestionIndex === state.questions.length - 1 ? finishQuiz() : goToNextQuestion();
}

function updateQuestionGrid() {
    if (!questionGrid) return;
    document.querySelectorAll('.question-box').forEach((box, i) => {
        box.classList.remove('current', 'answered');
        if (i === state.currentQuestionIndex) box.classList.add('current');
        else if (state.userAnswers[i] !== undefined) box.classList.add('answered');
    });
}

function goToPreviousQuestion() {
    if (state.currentQuestionIndex > 0) loadQuestion(state.currentQuestionIndex - 1);
}

function goToNextQuestion() {
    closeModal(explanationModal);
    state.currentQuestionIndex === state.questions.length - 1 ? finishQuiz() : loadQuestion(state.currentQuestionIndex + 1);
}

function finishQuiz() {
    if (Object.keys(state.userAnswers).length < state.questions.length) {
        showToast(unansweredToast, "You have unanswered questions!");
        return;
    }
    let correct = 0;
    state.questions.forEach((q, i) => { if (state.userAnswers[i] === q.answer) correct++; });
    const percent = Math.round((correct / state.questions.length) * 100);
    if (state.timerInterval) clearInterval(state.timerInterval);
    if (scorePercentage) scorePercentage.textContent = `${percent}%`;
    if (correctCountSpan) correctCountSpan.textContent = correct;
    if (totalQuestionsSpan) totalQuestionsSpan.textContent = state.questions.length;
    openModal(resultsModal);
}

function startTimer() {
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        updateTimerDisplay();
        if (state.timeRemaining <= 0) {
            clearInterval(state.timerInterval);
            finishQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const m = Math.floor(state.timeRemaining / 60);
    const s = state.timeRemaining % 60;
    if (quizTimer) {
        quizTimer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        quizTimer.classList.remove('timer-warning', 'timer-danger');
        if (state.timeRemaining < 60) quizTimer.classList.add('timer-danger');
        else if (state.timeRemaining < 300) quizTimer.classList.add('timer-warning');
    }
}

// =============================================
// UTILITIES
// =============================================

function showToast(toast, message) {
    if (!toast) return;
    const text = toast.querySelector('.toast-text');
    if (text) text.textContent = message;
    toast.classList.remove('hidden');
    toast.style.display = 'flex';
    setTimeout(() => {
        toast.classList.add('hidden');
        setTimeout(() => toast.style.display = 'none', 300);
    }, 3000);
}

function openModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.addEventListener('DOMContentLoaded', initApp);
