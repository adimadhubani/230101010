const express = require('express');
const router = express.Router();
const { VehicleSchedulerAPI, KnapsackSolver } = require('./knapsack');
const { logger } = require('../logging-middleware/logger');

const schedulerAPI = new VehicleSchedulerAPI();
const solver = new KnapsackSolver();

// GET /api/schedule/:depotId - Get optimal schedule for a depot
router.get('/:depotId', async (req, res) => {
  try {
    const depotId = parseInt(req.params.depotId);
    const mechanicHours = parseInt(req.query.hours) || 40; // Default 40 hours/week
    
    if (isNaN(depotId)) {
      return res.status(400).json({ error: 'Invalid depot ID' });
    }
    
    if (mechanicHours < 1 || mechanicHours > 1000) {
      return res.status(400).json({ error: 'Mechanic hours must be between 1 and 1000' });
    }
    
    logger.info(`Creating schedule for depot ${depotId} with ${mechanicHours} hours`);
    
    // Fetch all vehicles/tasks
    const tasks = await schedulerAPI.fetchVehicles();
    
    // Format tasks properly
    const formattedTasks = tasks.map(task => ({
      id: task.TaskID || task.ID || task.id,
      duration: task.Duration || task.duration || 1,
      impact: task.Impact || task.impact || 1
    }));
    
    // Solve knapsack
    const result = await solver.solve(formattedTasks, mechanicHours);
    
    res.json({
      success: true,
      depotId,
      mechanicHours,
      totalImpact: result.maxImpact,
      totalTime: result.totalTime,
      tasksSelected: result.selectedTasks.length,
      selectedTasks: result.selectedTasks
    });
  } catch (error) {
    logger.error('Error in schedule endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/schedule/optimize - Optimize schedule for multiple depots
router.post('/optimize', async (req, res) => {
  try {
    const { depots, mechanicHours } = req.body;
    
    if (!depots || !Array.isArray(depots)) {
      return res.status(400).json({ error: 'depots array required' });
    }
    
    const tasks = await schedulerAPI.fetchVehicles();
    const formattedTasks = tasks.map(task => ({
      id: task.TaskID || task.ID || task.id,
      duration: task.Duration || task.duration || 1,
      impact: task.Impact || task.impact || 1,
      depotId: task.depotId || 1
    }));
    
    const schedules = [];
    for (const depot of depots) {
      const depotTasks = formattedTasks.filter(t => t.depotId === depot.id);
      const result = await solver.solve(depotTasks, mechanicHours || depot.mechanicHours || 40);
      
      schedules.push({
        depotId: depot.id,
        ...result
      });
    }
    
    res.json({
      success: true,
      schedules
    });
  } catch (error) {
    logger.error('Error in optimize endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/schedule/demo - Demo endpoint showing algorithm comparison
router.get('/demo', async (req, res) => {
  // Sample tasks for demo
  const sampleTasks = [
    { id: 1, duration: 6, impact: 10 },
    { id: 2, duration: 3, impact: 5 },
    { id: 3, duration: 4, impact: 8 },
    { id: 4, duration: 2, impact: 4 },
    { id: 5, duration: 5, impact: 7 },
    { id: 6, duration: 1, impact: 3 },
    { id: 7, duration: 7, impact: 9 }
  ];
  
  const mechanicHours = 15;
  
  const exactResult = await solver.solve01Knapsack(sampleTasks, mechanicHours);
  const greedyResult = solver.solveGreedy(sampleTasks, mechanicHours);
  
  res.json({
    message: "Knapsack Algorithm Demo",
    mechanicHours,
    tasks: sampleTasks,
    exactAlgorithm: exactResult,
    greedyAlgorithm: greedyResult,
    comparison: {
      exactTotalImpact: exactResult.maxImpact,
      greedyTotalImpact: greedyResult.maxImpact,
      efficiency: `${((greedyResult.maxImpact / exactResult.maxImpact) * 100).toFixed(2)}% of optimal`
    }
  });
});

module.exports = router;