package com.example.data

import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

class Repository(private val db: AppDatabase) {
    val userStats: Flow<UserStatsEntity?> = db.userStatsDao().getUserStatsFlow()
    val categoryStats: Flow<List<CategoryStatEntity>> = db.categoryStatsDao().getAllCategoryStats()
    val achievements: Flow<List<AchievementEntity>> = db.achievementDao().getAllAchievements()
    val quizResults: Flow<List<QuizResultEntity>> = db.quizResultDao().getAllResults()

    suspend fun getQuestionsByCategory(categoryId: String) = db.questionDao().getQuestionsByCategory(categoryId)
    suspend fun getRandomQuestions(limit: Int = 10) = db.questionDao().getRandomQuestions(limit)
    suspend fun getDailyChallenge() = db.questionDao().getDailyChallenge()
    
    suspend fun unlockAchievement(id: String) {
        db.achievementDao().unlockAchievement(id, System.currentTimeMillis())
    }

    suspend fun seedDatabase() {
        if (db.questionDao().count() == 0) {
            db.questionDao().insertAll(QuestionBankSeeder.getQuestions())
            db.userStatsDao().updateUserStats(UserStatsEntity())
            db.achievementDao().insertAll(QuestionBankSeeder.getInitialAchievements())
            
            // Seed category stats
            val categories = listOf(
                "Technical Analysis", "Candlestick Patterns", "Chart Patterns",
                "Risk Management", "Trading Psychology", "Fundamentals",
                "Options Basics", "Crypto Markets"
            )
            categories.forEach {
                db.categoryStatsDao().updateCategoryStat(CategoryStatEntity(categoryId = it))
            }
        }
    }

    suspend fun saveQuizResult(
        score: Int,
        totalQuestions: Int,
        xpEarned: Int,
        categoryId: String,
        correctAnswersByCategory: Map<String, Int>
    ) {
        db.quizResultDao().insertResult(
            QuizResultEntity(
                score = score,
                totalQuestions = totalQuestions,
                xpEarned = xpEarned,
                categoryId = categoryId
            )
        )

        val stats = db.userStatsDao().getUserStats() ?: UserStatsEntity()
        val currentDays = LocalDate.now().toEpochDay()
        
        var newStreak = stats.currentStreak
        if (stats.lastPlayedDate == currentDays - 1) {
            newStreak += 1
        } else if (stats.lastPlayedDate < currentDays - 1) {
            newStreak = 1 // Reset streak if missed a day, but count today as 1
        } else if (stats.lastPlayedDate == 0L) {
             newStreak = 1
        }
        
        val newXp = stats.xp + xpEarned
        val newRank = calculateRank(newXp)

        db.userStatsDao().updateUserStats(
            stats.copy(
                xp = newXp,
                currentStreak = newStreak,
                lastPlayedDate = currentDays,
                totalQuestionsAnswered = stats.totalQuestionsAnswered + totalQuestions,
                correctQuestionsAnswered = stats.correctQuestionsAnswered + score,
                rank = newRank
            )
        )

        correctAnswersByCategory.forEach { (catId, correct) ->
            val catStat = db.categoryStatsDao().getCategoryStat(catId) ?: CategoryStatEntity(catId)
            db.categoryStatsDao().updateCategoryStat(
                catStat.copy(
                    totalQuestions = catStat.totalQuestions + totalQuestions, // approximation for mixed quizzes
                    correctQuestions = catStat.correctQuestions + correct
                )
            )
        }
    }
    
    private fun calculateRank(xp: Int): String {
        return when {
            xp < 500 -> "Rookie"
            xp < 1500 -> "Analyst"
            xp < 3000 -> "Trader"
            xp < 5000 -> "Senior Trader"
            xp < 8000 -> "Pro Trader"
            xp < 12000 -> "Market Wizard"
            else -> "Legend"
        }
    }
    
    suspend fun resetProgress() {
        db.userStatsDao().updateUserStats(UserStatsEntity())
        db.achievementDao().insertAll(QuestionBankSeeder.getInitialAchievements())
         val categories = listOf(
            "Technical Analysis", "Candlestick Patterns", "Chart Patterns",
            "Risk Management", "Trading Psychology", "Fundamentals",
            "Options Basics", "Crypto Markets"
        )
        categories.forEach {
            db.categoryStatsDao().updateCategoryStat(CategoryStatEntity(categoryId = it))
        }
    }
}
