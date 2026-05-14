#!/usr/bin/env node

const { logger } = require('./logging-middleware/logger');
const NotificationModel = require('./campus-notifications/models/Notification');
const { PriorityInbox } = require('./campus-notifications/api/priority-inbox');

console.log('\n🔔 Campus Notifications Platform Demo\n');
console.log('=' .repeat(50));

// Demo Priority Inbox
console.log('\n📨 Priority Inbox Demo:\n');

const sampleNotifications = [
  { ID: "1", Type: "Placement", Message: "CSX Corporation hiring", Timestamp: "2026-04-22 17:51:18" },
  { ID: "2", Type: "Event", Message: "Farewell party", Timestamp: "2026-04-22 17:51:06" },
  { ID: "3", Type: "Result", Message: "Mid-sem results", Timestamp: "2026-04-22 17:50:54" },
  { ID: "4", Type: "Placement", Message: "Google internship 2026", Timestamp: "2026-04-23 10:00:00" },
  { ID: "5", Type: "Result", Message: "Project review", Timestamp: "2026-04-22 17:50:42" }
];

const inbox = new PriorityInbox(5);

sampleNotifications.forEach(notif => {
  const model = new NotificationModel(notif);
  console.log(`  Added: ${notif.Type} - ${notif.Message.substring(0, 30)}... (Priority: ${model.priority.toFixed(2)})`);
  inbox.add(model);
});

console.log('\n  📊 Top 5 Priority Notifications:');
const top = inbox.getTop();
top.forEach((notif, i) => {
  console.log(`    ${i + 1}. [${notif.type}] ${notif.message.substring(0, 40)} (P:${notif.priority.toFixed(2)})`);
});

console.log('\n✅ Demo completed successfully!\n');