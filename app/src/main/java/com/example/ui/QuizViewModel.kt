package com.example.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.data.QuestionEntity
import com.example.data.Repository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class QuizState(
    val questions: List<QuestionEntity> = emptyList(),
    val currentIndex: Int = 0,
    val score: Int = 0,
    val xpEarned: Int = 0,
    val isFinished: Boolean = false,
    val isLoading: Boolean = true,
    val selectedOptionIndex: Int? = null,
    val isAnswerChecked: Boolean = false,
    val categoryId: String = "",
    val timeRemaining: Int = 30, // seconds for timer
    val correctAnswersByCategory: Map<String, Int> = emptyMap()
) {
    val currentQuestion: QuestionEntity?
        get() = questions.getOrNull(currentIndex)
}

class QuizViewModel(
    private val repository: Repository,
    private val categoryId: String,
    private val isDailyChallenge: Boolean
) : ViewModel() {

    private val _uiState = MutableStateFlow(QuizState(categoryId = categoryId))
    val uiState: StateFlow<QuizState> = _uiState.asStateFlow()

    private var timerJob: kotlinx.coroutines.Job? = null

    init {
        loadQuestions()
    }

    private fun loadQuestions() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val items = if (isDailyChallenge) {
                listOfNotNull(repository.getDailyChallenge())
            } else if (categoryId == "Mixed") {
                repository.getRandomQuestions(10)
            } else {
                repository.getQuestionsByCategory(categoryId).shuffled().take(10)
            }
            _uiState.update { it.copy(questions = items, isLoading = false) }
            startTimer()
        }
    }

    private fun startTimer() {
        timerJob?.cancel()
        _uiState.update { it.copy(timeRemaining = 30) }
        timerJob = viewModelScope.launch {
            while (_uiState.value.timeRemaining > 0 && !_uiState.value.isAnswerChecked) {
                delay(1000)
                _uiState.update { it.copy(timeRemaining = it.timeRemaining - 1) }
                if (_uiState.value.timeRemaining == 0) {
                    checkAnswer(null) // Time's up!
                }
            }
        }
    }

    fun selectOption(index: Int) {
        if (_uiState.value.isAnswerChecked) return
        _uiState.update { it.copy(selectedOptionIndex = index) }
        checkAnswer(index)
    }

    private fun checkAnswer(selectedIndex: Int?) {
        timerJob?.cancel()
        val q = _uiState.value.currentQuestion ?: return
        val isCorrect = selectedIndex == q.correctIndex

        var newXp = _uiState.value.xpEarned
        var newScore = _uiState.value.score
        val newCorrectByCategory = _uiState.value.correctAnswersByCategory.toMutableMap()

        if (isCorrect) {
            newScore++
            val xpGain = when (q.difficulty) {
                "BEGINNER" -> 10
                "INTERMEDIATE" -> 20
                "ADVANCED" -> 35
                "PRO" -> 50
                else -> 10
            }
            newXp += if (isDailyChallenge) xpGain * 2 else xpGain
            
            val count = newCorrectByCategory[q.categoryId] ?: 0
            newCorrectByCategory[q.categoryId] = count + 1
        }

        _uiState.update {
            it.copy(
                isAnswerChecked = true,
                score = newScore,
                xpEarned = newXp,
                correctAnswersByCategory = newCorrectByCategory
            )
        }
    }

    fun nextQuestion() {
        val state = _uiState.value
        if (state.currentIndex < state.questions.lastIndex) {
            _uiState.update {
                it.copy(
                    currentIndex = it.currentIndex + 1,
                    selectedOptionIndex = null,
                    isAnswerChecked = false
                )
            }
            startTimer()
        } else {
            finishQuiz()
        }
    }

    private fun finishQuiz() {
        _uiState.update { it.copy(isFinished = true) }
        viewModelScope.launch {
            val state = _uiState.value
            repository.saveQuizResult(
                score = state.score,
                totalQuestions = state.questions.size,
                xpEarned = state.xpEarned,
                categoryId = state.categoryId,
                correctAnswersByCategory = state.correctAnswersByCategory
            )
            // check achievements
            if (state.score == state.questions.size && state.questions.isNotEmpty()) {
                repository.unlockAchievement("perfect_round")
            }
            if (state.questions.size > 0 && state.categoryId == "Risk Management" && state.score == state.questions.size) {
                 repository.unlockAchievement("risk_manager")
            }
             repository.unlockAchievement("first_steps")
        }
    }
}

class QuizViewModelFactory(
    private val repository: Repository,
    private val categoryId: String,
    private val isDailyChallenge: Boolean
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(QuizViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return QuizViewModel(repository, categoryId, isDailyChallenge) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
