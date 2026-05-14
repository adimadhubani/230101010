const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const { logger } = require('../../logging-middleware/logger');
const { Notification } = require('../config/database');

// GET /api/notifications/top - Get top priority notifications
router.get('/top', async (req, res) => {
  try {
    const n = parseInt(req.query.n) || 10;
    
    if (n < 1 || n > 100) {
      return res.status(400).json({ error: 'n must be between 1 and 100' });
    }
    
    const topNotifications = await notificationService.getTopNotifications(n);
    
    logger.info(`Returned top ${topNotifications.length} notifications`);
    res.json({
      success: true,
      count: topNotifications.length,
      notifications: topNotifications
    });
  } catch (error) {
    logger.error('Error in /top endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notifications/student/:studentId - Get notifications for a student
router.get('/student/:studentId', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    const limit = parseInt(req.query.limit) || 50;
    
    const notifications = await notificationService.getNotificationsByStudent(studentId, limit);
    
    res.json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error) {
    logger.error('Error in /student endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications/read - Mark notification as read
router.post('/read', async (req, res) => {
  try {
    const { notificationId, studentId } = req.body;
    
    if (!notificationId || !studentId) {
      return res.status(400).json({ error: 'notificationId and studentId required' });
    }
    
    const notification = await notificationService.markAsRead(notificationId, studentId);
    
    res.json({
      success: true,
      notification
    });
  } catch (error) {
    logger.error('Error in /read endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications/notify-all - Send bulk notifications (Stage 5)
router.post('/notify-all', async (req, res) => {
  try {
    const { studentIds, message, type = 'placement' } = req.body;
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds array required' });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    logger.info(`Starting notify-all for ${studentIds.length} students`);
    
    // Step 1: Save notifications to DB first (for reliability)
    const notifications = studentIds.map(studentId => ({
      studentId,
      type: type.charAt(0).toUpperCase() + type.slice(1),
      message,
      timestamp: new Date(),
      isRead: false,
      priority: type === 'placement' ? 3 : (type === 'result' ? 2 : 1)
    }));
    
    const savedNotifications = await notificationService.bulkSaveNotifications(notifications);
    logger.info(`Saved ${savedNotifications.length} notifications to database`);
    
    // Step 2: Send emails asynchronously (non-blocking)
    // This prevents the request from timing out
    setImmediate(async () => {
      const emailResults = await emailService.sendBulkEmails(studentIds, message);
      logger.info(`Email sending completed: ${emailResults.success.length} success, ${emailResults.failed.length} failed`);
      
      // Store failed emails for retry (in production, would add to a queue)
      if (emailResults.failed.length > 0) {
        logger.warn(`${emailResults.failed.length} emails failed. Would add to retry queue.`);
      }
    });
    
    // Return immediately with success
    res.json({
      success: true,
      message: `Notifications queued for ${studentIds.length} students`,
      notificationsSaved: savedNotifications.length
    });
  } catch (error) {
    logger.error('Error in /notify-all endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/notifications/unread/:studentId - Get unread notifications count
router.get('/unread/:studentId', async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId);
    
    const unreadCount = await Notification.count({
      where: { studentId, isRead: false }
    });
    
    res.json({
      success: true,
      studentId,
      unreadCount
    });
  } catch (error) {
    logger.error('Error in /unread endpoint', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;