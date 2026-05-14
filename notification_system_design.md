# Campus Notifications System Design Document

## Stage 1: REST API Design & Real-time Mechanism

### Core Actions Supported
1. Fetch notifications for a student
2. Mark notification as read
3. Get unread count
4. Send bulk notifications
5. Real-time push notifications

### REST API Endpoints

#### GET /api/notifications/student/:studentId
Fetch notifications for a specific student

**Request Headers:**