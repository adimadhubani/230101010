require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { loggingMiddleware, logger } = require('./logging-middleware/logger');
const notificationsRouter = require('./campus-notifications/api/notifications');
const priorityInboxRouter = require('./campus-notifications/api/priority-inbox').router;
const schedulerRouter = require('./vehicle-scheduling/scheduler');
const { sequelize } = require('./campus-notifications/config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggingMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      notifications: true,
      scheduler: true
    }
  });
});

// API Routes
app.use('/api/notifications', notificationsRouter);
app.use('/api/priority-inbox', priorityInboxRouter);
app.use('/api/schedule', schedulerRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Campus Notifications & Vehicle Maintenance Platform',
    version: '1.0.0',
    endpoints: {
      notifications: {
        top: 'GET /api/notifications/top?n=10',
        student: 'GET /api/notifications/student/:studentId',
        unread: 'GET /api/notifications/unread/:studentId',
        notifyAll: 'POST /api/notifications/notify-all',
        markRead: 'POST /api/notifications/read'
      },
      priorityInbox: {
        update: 'POST /api/priority-inbox/update',
        get: 'GET /api/priority-inbox/:userId',
        demo: 'GET /api/priority-inbox/demo'
      },
      scheduler: {
        schedule: 'GET /api/schedule/:depotId?hours=40',
        optimize: 'POST /api/schedule/optimize',
        demo: 'GET /api/schedule/demo'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
async function startServer() {
  try {
    // Sync database
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized');
    
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
      console.log('\n📋 Available endpoints:');
      console.log('  GET  /api/notifications/top?n=10');
      console.log('  GET  /api/notifications/student/:studentId');
      console.log('  POST /api/notifications/notify-all');
      console.log('  GET  /api/priority-inbox/:userId');
      console.log('  GET  /api/schedule/:depotId?hours=40');
      console.log('\n📖 API Documentation: http://localhost:' + PORT);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

startServer();