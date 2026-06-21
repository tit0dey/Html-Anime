package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import com.example.data.OhlcData
import com.example.ui.theme.GlowGreen
import com.example.ui.theme.GlowRed

@Composable
fun CandlestickChart(
    data: List<OhlcData>,
    modifier: Modifier = Modifier
) {
    if (data.isEmpty()) return

    val maxHigh = data.maxOf { it.high }
    val minLow = data.minOf { it.low }
    val range = maxHigh - minLow

    Canvas(modifier = modifier.fillMaxSize()) {
        val candleWidth = size.width / data.size
        val halfCandle = candleWidth / 2
        val candlePadding = candleWidth * 0.2f

        data.forEachIndexed { index, ohlc ->
            val color = if (ohlc.close >= ohlc.open) GlowGreen else GlowRed
            
            // Normalize values matching the canvas height
            // We flip Y axis (0 is top, height is bottom)
            fun y(value: Float): Float {
                return size.height - ((value - minLow) / range) * size.height
            }

            val xCenter = index * candleWidth + halfCandle

            // Draw shadow (wick)
            drawLine(
                color = color,
                start = Offset(xCenter, y(ohlc.high)),
                end = Offset(xCenter, y(ohlc.low)),
                strokeWidth = 2f
            )

            // Draw body
            val topY = y(maxOf(ohlc.open, ohlc.close))
            val bottomY = y(minOf(ohlc.open, ohlc.close))
            val bodyHeight = maxOf(bottomY - topY, 2f)

            if (ohlc.close >= ohlc.open) {
                // Bullish - Hollow or outlined box
                drawRect(
                    color = color,
                    topLeft = Offset(index * candleWidth + candlePadding, topY),
                    size = Size(candleWidth - candlePadding * 2, bodyHeight),
                    style = Stroke(width = 2f)
                )
            } else {
                 // Bearish - Filled box
                 drawRect(
                    color = color,
                    topLeft = Offset(index * candleWidth + candlePadding, topY),
                    size = Size(candleWidth - candlePadding * 2, bodyHeight)
                )
            }
            
            if (ohlc.isHighlighted) {
                 drawCircle(
                     color = Color.Yellow,
                     radius = 4f,
                     center = Offset(xCenter, y(ohlc.high) - 16f)
                 )
            }
        }
    }
}
