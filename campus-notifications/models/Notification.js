class NotificationModel {
  constructor(notificationData) {
    this.id = notificationData.ID || notificationData.id;
    this.type = notificationData.Type || notificationData.type;
    this.message = notificationData.Message || notificationData.message;
    this.timestamp = notificationData.Timestamp || notificationData.timestamp;
    this.studentId = notificationData.studentId;
    this.isRead = false;
    this.priority = this.calculatePriority();
  }

  calculatePriority() {
    // Priority: Placement (3) > Result (2) > Event (1)
    const typePriority = {
      'Placement': 3,
      'Result': 2,
      'Event': 1
    };
    
    const basePriority = typePriority[this.type] || 0;
    
    // Add recency factor (newer = higher priority)
    const notificationTime = new Date(this.timestamp);
    const now = new Date();
    const hoursDiff = (now - notificationTime) / (1000 * 60 * 60);
    const recencyBonus = Math.max(0, 10 - hoursDiff) * 0.1;
    
    return basePriority + recencyBonus;
  }

  static comparePriority(a, b) {
    // Higher priority first, if tie then newer first
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return new Date(b.timestamp) - new Date(a.timestamp);
  }
}

module.exports = NotificationModel;