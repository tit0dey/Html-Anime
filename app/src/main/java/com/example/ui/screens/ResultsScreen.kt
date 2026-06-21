package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.Repository
import com.example.ui.components.GlassCard
import com.example.ui.theme.DeepBlack
import com.example.ui.theme.NavyAccent
import com.example.ui.theme.NeonBlue
import com.example.ui.theme.NeonCyan
import kotlinx.coroutines.flow.first

@Composable
fun ResultsScreen(repository: Repository, onContinue: () -> Unit) {
    var result by remember { mutableStateOf<com.example.data.QuizResultEntity?>(null) }
    var categoryStats by remember { mutableStateOf<List<com.example.data.CategoryStatEntity>>(emptyList()) }
    
    LaunchedEffect(Unit) {
        result = repository.quizResults.first().firstOrNull()
        categoryStats = repository.categoryStats.first()
    }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.radialGradient(colors = listOf(NavyAccent, DeepBlack)))
            .windowInsetsPadding(WindowInsets.safeDrawing),
        contentAlignment = Alignment.Center
    ) {
        if (result == null) {
            CircularProgressIndicator(color = NeonCyan)
            return
        }

        val r = result!!
        val accuracy = if (r.totalQuestions > 0) (r.score * 100) / r.totalQuestions else 0

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp).fillMaxWidth()
        ) {
            Text("Quiz Complete!", fontSize = 32.sp, color = Color.White, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(24.dp))
            
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                    Text("Score", color = Color.Gray, fontSize = 16.sp)
                    Text("${r.score} / ${r.totalQuestions}", fontSize = 48.sp, color = NeonCyan, fontWeight = FontWeight.Black)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Accuracy", color = Color.Gray, fontSize = 16.sp)
                    Text("$accuracy%", fontSize = 24.sp, color = Color.White)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("XP Earned", color = Color.Gray, fontSize = 16.sp)
                    Text("+${r.xpEarned} XP", fontSize = 24.sp, color = NeonBlue, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            
            if (categoryStats.isNotEmpty()) {
                Text("Performance Breakdown", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(16.dp))
                StatBarChart(stats = categoryStats)
                Spacer(modifier = Modifier.height(24.dp))
            }
            
            Button(
                onClick = onContinue,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NeonBlue)
            ) {
                Text("Continue", fontSize = 18.sp, color = Color.White)
            }
        }
    }
}

@Composable
fun StatBarChart(stats: List<com.example.data.CategoryStatEntity>) {
    val displayCats = listOf("Chart Patterns", "Risk Management", "Trading Psychology")
    val chartData = stats.filter { it.categoryId in displayCats }.map {
        val acc = if (it.totalQuestions > 0) it.correctQuestions.toFloat() / it.totalQuestions else 0f
        it.categoryId to acc
    }
    
    // Ensure we have dummy data to show the empty categories if they haven't been played
    val finalData = displayCats.map { cat ->
        val existing = chartData.find { it.first == cat }
        existing ?: Pair(cat, 0f)
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(140.dp)
            .padding(horizontal = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom
    ) {
        finalData.forEach { (label, value) ->
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom,
                modifier = Modifier.fillMaxHeight().weight(1f)
            ) {
                Text(
                    text = "${(value * 100).toInt()}%",
                    color = NeonCyan,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                Box(
                    modifier = Modifier
                        .width(40.dp)
                        .fillMaxHeight(value.coerceAtLeast(0.05f))
                        .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(NeonCyan, NeonBlue)
                            )
                        )
                )
                Spacer(modifier = Modifier.height(8.dp))
                val shortLabel = when (label) {
                    "Chart Patterns" -> "Charts"
                    "Risk Management" -> "Risk"
                    "Trading Psychology" -> "Psych"
                    else -> label.take(5)
                }
                Text(shortLabel, color = Color.White, fontSize = 12.sp)
            }
        }
    }
}
