package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.components.GlassCard
import com.example.ui.theme.DeepBlack
import com.example.ui.theme.NavyAccent
import com.example.ui.theme.NeonBlue
import com.example.ui.theme.NeonCyan

@Composable
fun LearnHubScreen() {
    val items = listOf(
        Pair("Doji", "A Doji is formed when the opening and closing prices are almost the same. It signifies indecision in the market."),
        Pair("Head and Shoulders", "A reversal pattern signifying the end of an uptrend. Characterized by three peaks, with the middle peak (the head) being the highest."),
        Pair("RSI (Relative Strength Index)", "A momentum oscillator that measures the speed and change of price movements. Values > 70 are overbought, < 30 are oversold."),
        Pair("MACD", "Moving Average Convergence Divergence. A trend-following momentum indicator that shows the relationship between two moving averages of a security's price."),
        Pair("Engulfing Pattern", "A two-candle pattern indicating a strong reversal. The second candle completely 'engulfs' the body of the previous smaller candle."),
        Pair("Support and Resistance", "Support is a price level where a downtrend tends to pause due to a concentration of demand. Resistance is where an uptrend tends to pause due to selling interest."),
        Pair("Position Sizing", "The most critical aspect of risk management. It dictates how many shares or contracts you should trade to limit your risk to a predetermined percentage of your account (e.g., 1%).")
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.radialGradient(colors = listOf(NavyAccent, DeepBlack)))
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text("Learn Hub", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = NeonCyan)
            Spacer(modifier = Modifier.height(16.dp))
        }

        items(items) { item ->
            GlassCard(modifier = Modifier.fillMaxWidth()) {
                Column {
                    Text(item.first, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NeonBlue)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(item.second, fontSize = 16.sp, color = Color.White)
                }
            }
        }
    }
}
