const axios = require('axios');
const { logger } = require('../logging-middleware/logger');

class KnapsackSolver {
  constructor() {
    this.memo = new Map();
  }

  // 0/1 Knapsack algorithm for task selection
  solve01Knapsack(tasks, mechanicHours) {
    const n = tasks.length;
    const dp = Array(n + 1).fill().map(() => Array(mechanicHours + 1).fill(0));
    const selected = Array(n + 1).fill().map(() => Array(mechanicHours + 1).fill(false));
    
    logger.info(`Solving knapsack with ${n} tasks and ${mechanicHours} hours`);
    
    // Build DP table
    for (let i = 1; i <= n; i++) {
      const task = tasks[i - 1];
      for (let w = 0; w <= mechanicHours; w++) {
        if (task.duration <= w) {
          const include = dp[i - 1][w - task.duration] + task.impact;
          const exclude = dp[i - 1][w];
          
          if (include > exclude) {
            dp[i][w] = include;
            selected[i][w] = true;
          } else {
            dp[i][w] = exclude;
            selected[i][w] = false;
          }
        } else {
          dp[i][w] = dp[i - 1][w];
          selected[i][w] = false;
        }
      }
    }
    
    // Backtrack to find selected tasks
    const selectedTasks = [];
    let w = mechanicHours;
    for (let i = n; i > 0; i--) {
      if (selected[i][w]) {
        selectedTasks.push(tasks[i - 1]);
        w -= tasks[i - 1].duration;
      }
    }
    
    const maxImpact = dp[n][mechanicHours];
    logger.info(`Knapsack solved. Max impact: ${maxImpact}, Selected tasks: ${selectedTasks.length}`);
    
    return {
      maxImpact,
      selectedTasks: selectedTasks.reverse(),
      totalTime: selectedTasks.reduce((sum, task) => sum + task.duration, 0)
    };
  }

  // Greedy algorithm for large datasets (approximation)
  solveGreedy(tasks, mechanicHours) {
    // Sort by impact/duration ratio (efficiency)
    const sorted = [...tasks].sort((a, b) => 
      (b.impact / b.duration) - (a.impact / a.duration)
    );
    
    let totalTime = 0;
    let totalImpact = 0;
    const selected = [];
    
    for (const task of sorted) {
      if (totalTime + task.duration <= mechanicHours) {
        selected.push(task);
        totalTime += task.duration;
        totalImpact += task.impact;
      }
    }
    
    logger.info(`Greedy solution: Impact ${totalImpact}, Time ${totalTime}, Tasks ${selected.length}`);
    
    return {
      maxImpact: totalImpact,
      selectedTasks: selected,
      totalTime
    };
  }

  // Hybrid approach: Use exact for small n, approximation for large n
  async solve(tasks, mechanicHours) {
    const n = tasks.length;
    
    // Use exact DP for <= 2000 tasks
    if (n <= 2000) {
      logger.info(`Using exact DP for ${n} tasks`);
      return this.solve01Knapsack(tasks, mechanicHours);
    } else {
      logger.info(`Using greedy approximation for ${n} tasks (exceeds threshold)`);
      return this.solveGreedy(tasks, mechanicHours);
    }
  }
}

// API client for fetching tasks
class VehicleSchedulerAPI {
  constructor() {
    this.depotApi = 'http://4.224.186.213/evaluation-service/depots';
    this.vehiclesApi = 'http://4.224.186.213/evaluation-service/vehicles';
  }

  async fetchDepots() {
    try {
      logger.info('Fetching depots from API');
      const response = await axios.get(this.depotApi, {
        headers: {
          'Authorization': process.env.API_TOKEN || 'Bearer test-token'
        }
      });
      
      const depots = response.data.depots || [];
      logger.info(`Fetched ${depots.length} depots`);
      return depots;
    } catch (error) {
      logger.error('Error fetching depots', { error: error.message });
      throw error;
    }
  }

  async fetchVehicles() {
    try {
      logger.info('Fetching vehicles from API');
      const response = await axios.get(this.vehiclesApi, {
        headers: {
          'Authorization': process.env.API_TOKEN || 'Bearer test-token'
        }
      });
      
      // Note: The API response structure might differ
      // Based on the screenshots, the vehicles API returns tasks with Duration and Impact
      const vehicles = response.data.vehicles || response.data.tasks || [];
      logger.info(`Fetched ${vehicles.length} vehicles/tasks`);
      return vehicles;
    } catch (error) {
      logger.error('Error fetching vehicles', { error: error.message });
      throw error;
    }
  }

  async scheduleForDepot(depotId, mechanicHours) {
    try {
      const allTasks = await this.fetchVehicles();
      
      // Filter tasks for this depot if needed
      const depotTasks = allTasks.filter(task => task.depotId === depotId);
      
      const solver = new KnapsackSolver();
      const result = await solver.solve(depotTasks, mechanicHours);
      
      logger.info(`Schedule created for depot ${depotId}`, {
        totalImpact: result.maxImpact,
        totalTime: result.totalTime,
        tasksCount: result.selectedTasks.length
      });
      
      return {
        depotId,
        mechanicHours,
        ...result
      };
    } catch (error) {
      logger.error(`Error scheduling for depot ${depotId}`, { error: error.message });
      throw error;
    }
  }
}

module.exports = { KnapsackSolver, VehicleSchedulerAPI };