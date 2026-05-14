const axios = require('axios');
const { logger } = require('../../logging-middleware/logger');
const NotificationModel = require('../models/Notification');
const { Notification } = require('../config/database');

const API_URL = 'http://4.224.186.213/evaluation-service/notifications';

class NotificationService {
  constructor() {
    this.notificationsCache = [];
    this.lastFetchTime = null;
    this.cacheTimeout = 60000; // 1 minute cache
  }

  async fetchNotifications() {
    try {
      logger.info('Fetching notifications from API');
      
      const response = await axios.get(API_URL, {
        headers: {
          'Authorization': process.env.API_TOKEN || 'Bearer test-token'
        }
      });
      
      const notifications = response.data.notifications || [];
      logger.info(`Fetched ${notifications.length} notifications`);
      
      // Convert to our model format
      const formattedNotifications = notifications.map(notif => new NotificationModel(notif));
      
      // Sort by priority
      formattedNotifications.sort(NotificationModel.comparePriority);
      
      this.notificationsCache = formattedNotifications;
      this.lastFetchTime = Date.now();
      
      return formattedNotifications;
    } catch (error) {
      logger.error('Error fetching notifications', { error: error.message });
      throw error;
    }
  }

  async getTopNotifications(n = 10) {
    // Check cache
    if (this.notificationsCache.length === 0 || 
        (Date.now() - this.lastFetchTime) > this.cacheTimeout) {
      await this.fetchNotifications();
    }
    
    // Return top n notifications
    const topN = this.notificationsCache.slice(0, n);
    logger.info(`Returning top ${topN.length} priority notifications`);
    
    return topN;
  }

  async getNotificationsByStudent(studentId, limit = 50) {
    try {
      const notifications = await Notification.findAll({
        where: { studentId },
        order: [['priority', 'DESC'], ['timestamp', 'DESC']],
        limit
      });
      
      logger.info(`Fetched ${notifications.length} notifications for student ${studentId}`);
      return notifications;
    } catch (error) {
      logger.error('Error fetching student notifications', { error: error.message });
      throw error;
    }
  }

  async markAsRead(notificationId, studentId) {
    try {
      const notification = await Notification.findOne({
        where: { id: notificationId, studentId }
      });
      
      if (notification) {
        notification.isRead = true;
        await notification.save();
        logger.info(`Notification ${notificationId} marked as read`);
      }
      
      return notification;
    } catch (error) {
      logger.error('Error marking notification as read', { error: error.message });
      throw error;
    }
  }

  async saveNotification(notificationData) {
    try {
      const notification = await Notification.create(notificationData);
      logger.info(`Saved notification ${notification.id} to database`);
      return notification;
    } catch (error) {
      logger.error('Error saving notification', { error: error.message });
      throw error;
    }
  }

  async bulkSaveNotifications(notifications) {
    try {
      const saved = await Notification.bulkCreate(notifications);
      logger.info(`Bulk saved ${saved.length} notifications`);
      return saved;
    } catch (error) {
      logger.error('Error bulk saving notifications', { error: error.message });
      throw error;
    }
  }
}

module.exports = new NotificationService();