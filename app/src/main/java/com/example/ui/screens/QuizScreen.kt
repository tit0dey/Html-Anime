package com.example.ui.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.OhlcData
import com.example.ui.QuizViewModel
import com.example.ui.components.CandlestickChart
import com.example.ui.theme.DeepBlack
import com.example.ui.theme.GlowGreen
import com.example.ui.theme.GlowRed
import com.example.ui.theme.NavyAccent
import com.example.ui.theme.NeonBlue
import com.example.ui.theme.NeonCyan
import com.example.ui.theme.TextSecondary
import com.example.ui.theme.TextPrimary
import kotlin.random.Random

@Composable
fun QuizScreen(viewModel: QuizViewModel, onFinish: () -> Unit, onBack: () -> Unit) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.isFinished) {
        if (state.isFinished) onFinish()
    }

    if (state.isLoading) {
        Box(modifier = Modifier.fillMaxSize().background(DeepBlack), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = NeonCyan)
        }
        return
    }

    val q = state.currentQuestion ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.radialGradient(colors = listOf(NavyAccent, DeepBlack)))
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(16.dp)
    ) {
        // Header (Progress & Timer)
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onBack) {
                Text("Quit", color = Color.Gray)
            }
            AnimatedContent(
                targetState = state.score,
                transitionSpec = {
                    if (targetState > initialState) {
                        (slideInVertically { height -> height } + fadeIn()).togetherWith(slideOutVertically { height -> -height } + fadeOut())
                    } else {
                        (slideInVertically { height -> -height } + fadeIn()).togetherWith(slideOutVertically { height -> height } + fadeOut())
                    }.using(SizeTransform(clip = false))
                },
                label = "score"
            ) { targetScore ->
                Text("Score: $targetScore", color = NeonCyan, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            }
            Box(contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    progress = { state.timeRemaining / 30f },
                    color = if (state.timeRemaining > 10) NeonCyan else GlowRed,
                    strokeWidth = 3.dp,
                    modifier = Modifier.size(40.dp)
                )
                
                val timerColor by animateColorAsState(
                    targetValue = if (state.timeRemaining > 10) Color.White else GlowRed,
                    label = "timerColor"
                )
                Text(
                    text = "${state.timeRemaining}",
                    color = timerColor,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        
        LinearProgressIndicator(
            progress = { (state.currentIndex) / state.questions.size.coerceAtLeast(1).toFloat() },
            modifier = Modifier.fillMaxWidth().height(4.dp),
            color = NeonBlue
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Question
        Text(
            text = q.text,
            color = Color.White,
            fontSize = 22.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        // Synthesize Chart if applicable
        if (q.categoryId in listOf("Candlestick Patterns", "Chart Patterns", "Technical Analysis")) {
            val syntheticData = remember(q.id) { generateSyntheticChart() }
            Box(modifier = Modifier.fillMaxWidth().height(200.dp).padding(vertical = 16.dp)) {
                CandlestickChart(data = syntheticData)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Options
        val options = listOf(q.option0, q.option1, q.option2, q.option3)
        options.forEachIndexed { index, optText ->
            val isSelected = state.selectedOptionIndex == index
            val isCorrect = q.correctIndex == index
            val showFeedback = state.isAnswerChecked

            val bgColor by animateColorAsState(
                targetValue = when {
                    showFeedback && isCorrect -> GlowGreen.copy(alpha = 0.2f)
                    showFeedback && isSelected && !isCorrect -> GlowRed.copy(alpha = 0.2f)
                    isSelected -> NeonBlue.copy(alpha = 0.2f)
                    else -> Color.Transparent
                }
            )

            val borderColor by animateColorAsState(
                targetValue = when {
                    showFeedback && isCorrect -> GlowGreen
                    showFeedback && isSelected && !isCorrect -> GlowRed
                    isSelected -> NeonBlue
                    else -> NeonBlue.copy(alpha = 0.3f)
                }
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(bgColor)
                    .border(2.dp, borderColor, RoundedCornerShape(12.dp))
                    .clickable(enabled = !state.isAnswerChecked) {
                        viewModel.selectOption(index)
                    }
                    .padding(16.dp)
            ) {
                Text(optText, color = Color.White)
            }
        }

        if (state.isAnswerChecked) {
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = q.explanation,
                color = TextSecondary,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(16.dp)
            )
            Button(
                onClick = { viewModel.nextQuestion() },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = NeonBlue)
            ) {
                Text("Next", fontSize = 18.sp, color = Color.White)
            }
        }
    }
}

fun generateSyntheticChart(): List<OhlcData> {
    val list = mutableListOf<OhlcData>()
    var currentPrice = 100f
    for (i in 0 until 30) {
        val open = currentPrice
        val close = currentPrice + Random.nextInt(-5, 6)
        val high = maxOf(open, close) + Random.nextInt(0, 5)
        val low = minOf(open, close) - Random.nextInt(0, 5)
        list.add(OhlcData(open, high, low, close, isHighlighted = i == 25))
        currentPrice = close
    }
    return list
}
