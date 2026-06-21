package com.example.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.TradeIqApplication
import com.example.ui.screens.*
import com.example.ui.theme.DeepBlack
import com.example.ui.theme.NeonBlue
import com.example.ui.theme.NeonCyan

@Composable
fun TradeIQApp(app: TradeIqApplication) {
    val navController = rememberNavController()
    val mainViewModel: MainViewModel = viewModel(
        factory = MainViewModelFactory(app.repository)
    )
    val userStats by mainViewModel.userStats.collectAsState()

    if (userStats != null) {
        val startDest = if (userStats?.xp == 0 && userStats?.totalQuestionsAnswered == 0) "onboarding" else "dashboard"

        Scaffold(
            bottomBar = {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                val showBottomBar = currentDestination?.route in listOf("dashboard", "learn", "profile")

                if (showBottomBar) {
                    NavigationBar(
                        containerColor = DeepBlack,
                        contentColor = NeonCyan
                    ) {
                        NavigationBarItem(
                            icon = { Icon(Icons.Outlined.Home, contentDescription = "Home") },
                            label = { Text("Home") },
                            selected = currentDestination?.hierarchy?.any { it.route == "dashboard" } == true,
                            onClick = {
                                navController.navigate("dashboard") {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = DeepBlack,
                                selectedTextColor = NeonCyan,
                                indicatorColor = NeonCyan,
                                unselectedIconColor = NeonBlue,
                                unselectedTextColor = NeonBlue
                            )
                        )
                        NavigationBarItem(
                            icon = { Icon(Icons.Outlined.MenuBook, contentDescription = "Learn") },
                            label = { Text("Learn") },
                            selected = currentDestination?.hierarchy?.any { it.route == "learn" } == true,
                            onClick = {
                                navController.navigate("learn") {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = DeepBlack,
                                selectedTextColor = NeonCyan,
                                indicatorColor = NeonCyan,
                                unselectedIconColor = NeonBlue,
                                unselectedTextColor = NeonBlue
                            )
                        )
                        NavigationBarItem(
                            icon = { Icon(Icons.Outlined.Person, contentDescription = "Profile") },
                            label = { Text("Profile") },
                            selected = currentDestination?.hierarchy?.any { it.route == "profile" } == true,
                            onClick = {
                                navController.navigate("profile") {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = DeepBlack,
                                selectedTextColor = NeonCyan,
                                indicatorColor = NeonCyan,
                                unselectedIconColor = NeonBlue,
                                unselectedTextColor = NeonBlue
                            )
                        )
                    }
                }
            }
        ) { innerPadding ->
            NavHost(
                navController = navController,
                startDestination = startDest,
                modifier = Modifier.padding(innerPadding).background(DeepBlack)
            ) {
                composable("onboarding") {
                    OnboardingScreen(onFinish = {
                        navController.navigate("dashboard") { popUpTo("onboarding") { inclusive = true } }
                    })
                }
                composable("dashboard") {
                    DashboardScreen(viewModel = mainViewModel, onNavigateToQuiz = { cat, isDaily ->
                        navController.navigate("quiz/$cat/$isDaily")
                    })
                }
                composable("learn") { LearnHubScreen() }
                composable("profile") { ProfileScreen(viewModel = mainViewModel) }
                composable("quiz/{categoryId}/{isDaily}") { backStackEntry ->
                    val cat = backStackEntry.arguments?.getString("categoryId") ?: "Mixed"
                    val isDaily = backStackEntry.arguments?.getString("isDaily")?.toBoolean() ?: false
                    val quizViewModel: QuizViewModel = viewModel(factory = QuizViewModelFactory(app.repository, cat, isDaily))
                    QuizScreen(
                        viewModel = quizViewModel,
                        onFinish = { navController.navigate("results/$cat") { popUpTo("dashboard") } },
                        onBack = { navController.popBackStack() }
                    )
                }
                composable("results/{categoryId}") {
                    ResultsScreen(repository = app.repository, onContinue = {
                        navController.navigate("dashboard") { popUpTo("dashboard") { inclusive = true } }
                    })
                }
            }
        }
    }
}
