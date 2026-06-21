package com.example

import android.app.Application
import com.example.data.AppDatabase
import com.example.data.Repository

class TradeIqApplication : Application() {
    val database by lazy { AppDatabase.getDatabase(this) }
    val repository by lazy { Repository(database) }
}
