const { logger } = require('../../logging-middleware/logger');

// Mock email service for demonstration
class EmailService {
  async sendEmail(studentId, message, type) {
    // Simulate email sending with potential failures
    return new Promise((resolve, reject) => {
      const shouldFail = Math.random() < 0.1; // 10% failure rate for demo
      
      setTimeout(() => {
        if (shouldFail) {
          logger.error(`Failed to send email to student ${studentId}`, { 
            studentId, 
            message,
            error: 'Email service temporarily unavailable'
          });
          reject(new Error(`Email failed for student ${studentId}`));
        } else {
          logger.info(`Email sent to student ${studentId}`, { 
            studentId, 
            message,
            type
          });
          resolve({ success: true, studentId });
        }
      }, 100);
    });
  }

  async sendBulkEmails(students, message, batchSize = 100) {
    const results = {
      success: [],
      failed: []
    };
    
    logger.info(`Starting bulk email to ${students.length} students`);
    
    // Process in batches
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);
      logger.info(`Processing batch ${i / batchSize + 1} of ${Math.ceil(students.length / batchSize)}`);
      
      const batchPromises = batch.map(studentId => 
        this.sendEmail(studentId, message, 'placement')
          .then(result => results.success.push(result))
          .catch(error => results.failed.push({ studentId, error: error.message }))
      );
      
      await Promise.allSettled(batchPromises);
      
      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    logger.info(`Bulk email completed. Success: ${results.success.length}, Failed: ${results.failed.length}`);
    return results;
  }
}

module.exports = new EmailService();