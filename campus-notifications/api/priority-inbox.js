const express = require('express');
const router = express.Router();
const { logger } = require('../../logging-middleware/logger');
const NotificationModel = require('../models/Notification');

// Priority queue implementation using Min/Max Heap
class PriorityInbox {
  constructor(maxSize = 10) {
    this.maxSize = maxSize;
    this.heap = [];
  }

  // Heap operations
  getParentIndex(index) { return Math.floor((index - 1) / 2); }
  getLeftChildIndex(index) { return 2 * index + 1; }
  getRightChildIndex(index) { return 2 * index + 2; }

  swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  // Higher priority = higher score
  hasHigherPriority(i, j) {
    if (i >= this.heap.length || j >= this.heap.length) return false;
    return this.heap[i].priority > this.heap[j].priority;
  }

  heapifyUp(index) {
    let currentIndex = index;
    while (currentIndex > 0) {
      const parentIndex = this.getParentIndex(currentIndex);
      if (this.hasHigherPriority(currentIndex, parentIndex)) {
        this.swap(currentIndex, parentIndex);
        currentIndex = parentIndex;
      } else {
        break;
      }
    }
  }

  heapifyDown(index) {
    let currentIndex = index;
    while (this.getLeftChildIndex(currentIndex) < this.heap.length) {
      let higherPriorityChild = this.getLeftChildIndex(currentIndex);
      const rightChild = this.getRightChildIndex(currentIndex);
      
      if (rightChild < this.heap.length && 
          this.hasHigherPriority(rightChild, higherPriorityChild)) {
        higherPriorityChild = rightChild;
      }
      
      if (this.hasHigherPriority(higherPriorityChild, currentIndex)) {
        this.swap(higherPriorityChild, currentIndex);
        currentIndex = higherPriorityChild;
      } else {
        break;
      }
    }
  }

  add(notification) {
    if (this.heap.length < this.maxSize) {
      // If heap not full, add and heapify up
      this.heap.push(notification);
      this.heapifyUp(this.heap.length - 1);
    } else if (notification.priority > this.heap[0].priority) {
      // If new notification has higher priority than the lowest in heap
      // Remove lowest and add new
      this.heap[0] = notification;
      this.heapifyDown(0);
    }
    
    // Always maintain sorted order for display
    this.heap.sort((a, b) => b.priority - a.priority);
  }

  getTop() {
    return [...this.heap];
  }

  size() {
    return this.heap.length;
  }
}

// Cache for priority inboxes per user
const userInboxes = new Map();

// POST /api/priority-inbox/update - Update priority inbox with new notifications
router.post('/update', async (req, res) => {
  try {
    const { userId, notifications, topN = 10 } = req.body;
    
    if (!userId || !notifications || !Array.isArray(notifications)) {
      return res.status(400).json({ error: 'userId and notifications array required' });
    }
    
    // Get or create user's priority inbox
    let inbox = userInboxes.get(userId);
    if (!inbox) {
      inbox = new PriorityInbox(topN);
      userInboxes.set(userId, inbox);
    }
    
    // Add each notification to the priority inbox
    for (const notif of notifications) {
      const notificationModel = new NotificationModel(notif);
      inbox.add(notificationModel);
    }
    
    logger.info(`Updated priority inbox for user ${userId}`, { 
      newNotifications: notifications.length,
      totalInbox: inbox.size()
    });
    
    res.json({
      success: true,
      userId,
      topNotifications: inbox.getTop(),
      count: inbox.size()
    });
  } catch (error) {
    logger.error('Error updating priority inbox', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/priority-inbox/:userId - Get priority inbox for user
router.get('/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const inbox = userInboxes.get(userId);
    
    if (!inbox) {
      return res.json({
        success: true,
        userId,
        notifications: [],
        count: 0
      });
    }
    
    res.json({
      success: true,
      userId,
      notifications: inbox.getTop(),
      count: inbox.size()
    });
  } catch (error) {
    logger.error('Error fetching priority inbox', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/priority-inbox/demo - Demo endpoint showing priority algorithm
router.get('/demo', async (req, res) => {
  // Sample notifications for demo
  const sampleNotifications = [
    { ID: "1", Type: "Placement", Message: "CSX Corporation hiring", Timestamp: "2026-04-22 17:51:18" },
    { ID: "2", Type: "Event", Message: "farewell", Timestamp: "2026-04-22 17:51:06" },
    { ID: "3", Type: "Result", Message: "mid-sem", Timestamp: "2026-04-22 17:50:54" },
    { ID: "4", Type: "Result", Message: "project-review", Timestamp: "2026-04-22 17:50:42" },
    { ID: "5", Type: "Result", Message: "external", Timestamp: "2026-04-22 17:50:30" },
    { ID: "6", Type: "Placement", Message: "Google internship", Timestamp: "2026-04-23 10:00:00" },
    { ID: "7", Type: "Event", Message: "Tech Symposium", Timestamp: "2026-04-24 09:00:00" },
    { ID: "8", Type: "Result", Message: "Final exams", Timestamp: "2026-04-25 14:00:00" },
    { ID: "9", Type: "Placement", Message: "Amazon hiring", Timestamp: "2026-04-26 11:00:00" },
    { ID: "10", Type: "Event", Message: "Career Fair", Timestamp: "2026-04-27 10:00:00" },
    { ID: "11", Type: "Result", Message: "Assignment grades", Timestamp: "2026-04-21 16:00:00" },
    { ID: "12", Type: "Placement", Message: "Microsoft SDE role", Timestamp: "2026-04-22 09:00:00" }
  ];
  
  // Calculate priorities
  const notificationsWithPriority = sampleNotifications.map(notif => {
    const model = new NotificationModel(notif);
    return {
      ...notif,
      priority: model.priority,
      typePriority: { Placement: 3, Result: 2, Event: 1 }[notif.Type]
    };
  });
  
  // Sort by priority
  const sorted = [...notificationsWithPriority].sort((a, b) => b.priority - a.priority);
  
  res.json({
    message: "Priority calculation demo",
    calculationFormula: "Priority = TypeWeight(Placement:3, Result:2, Event:1) + RecencyBonus(Max(0, 10-hoursAgo)*0.1)",
    top10: sorted.slice(0, 10),
    allNotifications: notificationsWithPriority
  });
});

module.exports = { router, PriorityInbox };