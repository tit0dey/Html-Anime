package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.MainViewModel
import com.example.ui.components.GlassCard
import com.example.ui.theme.DeepBlack
import com.example.ui.theme.NavyAccent
import com.example.ui.theme.NeonBlue
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.TextSecondary

@Composable
fun ProfileScreen(viewModel: MainViewModel) {
    val stats by viewModel.userStats.collectAsState()
    val categoryStats by viewModel.categoryStats.collectAsState()
    val achievements by viewModel.achievements.collectAsState()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.radialGradient(colors = listOf(NavyAccent, DeepBlack)))
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        item {
            Text("Profile & Stats", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = NeonCyan)
        }

        stats?.let { s ->
            item {
                val acc = if (s.totalQuestionsAnswered > 0) (s.correctQuestionsAnswered * 100) / s.totalQuestionsAnswered else 0
                GlassCard(modifier = Modifier.fillMaxWidth()) {
                    Column {
                        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Text("Total XP", color = TextSecondary)
                            Text("${s.xp}", color = NeonBlue, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Text("Overall Accuracy", color = TextSecondary)
                            Text("$acc%", color = NeonCyan, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Text("Questions Answered", color = TextSecondary)
                            Text("${s.totalQuestionsAnswered}", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            item {
                Text("Category Strength", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Spacer(modifier = Modifier.height(16.dp))
                categoryStats.forEach { cat ->
                    val catAcc = if (cat.totalQuestions > 0) cat.correctQuestions.toFloat() / cat.totalQuestions else 0f
                    Column(modifier = Modifier.padding(bottom = 12.dp)) {
                        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Text(cat.categoryId, color = TextSecondary, fontSize = 14.sp)
                            Text("${(catAcc * 100).toInt()}%", color = Color.White, fontSize = 14.sp)
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        LinearProgressIndicator(
                            progress = { catAcc },
                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                            color = NeonBlue
                        )
                    }
                }
            }

            item {
                Text("Achievements", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
                Spacer(modifier = Modifier.height(16.dp))
            }

            items(achievements) { ach ->
                GlassCard(modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(24.dp))
                                .background(if (ach.isUnlocked) NeonCyan.copy(alpha = 0.2f) else Color.DarkGray)
                                .border(2.dp, if (ach.isUnlocked) NeonCyan else Color.Gray, RoundedCornerShape(24.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(if (ach.isUnlocked) "🏆" else "🔒", fontSize = 20.sp)
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(ach.title, color = if (ach.isUnlocked) Color.White else Color.Gray, fontWeight = FontWeight.Bold)
                            Text(ach.description, color = TextSecondary, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}
