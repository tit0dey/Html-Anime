package com.example.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Entity(tableName = "questions")
data class QuestionEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val text: String,
    val categoryId: String,
    val difficulty: String, // BEGINNER, INTERMEDIATE, ADVANCED, PRO
    val chartDataStr: String?, // JSON serialized OHLC data list if applicable
    val option0: String,
    val option1: String,
    val option2: String,
    val option3: String,
    val correctIndex: Int,
    val explanation: String
)

@Serializable
data class OhlcData(
    val open: Float,
    val high: Float,
    val low: Float,
    val close: Float,
    val isHighlighted: Boolean = false
)

@Entity(tableName = "user_stats")
data class UserStatsEntity(
    @PrimaryKey val id: Int = 1,
    val xp: Int = 0,
    val currentStreak: Int = 0,
    val lastPlayedDate: Long = 0, // days since epoch
    val totalQuestionsAnswered: Int = 0,
    val correctQuestionsAnswered: Int = 0,
    val rank: String = "Rookie"
)

@Entity(tableName = "category_stats")
data class CategoryStatEntity(
    @PrimaryKey val categoryId: String,
    val totalQuestions: Int = 0,
    val correctQuestions: Int = 0
)

@Entity(tableName = "quiz_results")
data class QuizResultEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val timestamp: Long = System.currentTimeMillis(),
    val score: Int,
    val totalQuestions: Int,
    val xpEarned: Int,
    val categoryId: String
)

@Entity(tableName = "achievements")
data class AchievementEntity(
    @PrimaryKey val id: String, // e.g., "first_steps"
    val title: String,
    val description: String,
    val iconName: String,
    val isUnlocked: Boolean = false,
    val unlockedAt: Long = 0
)
