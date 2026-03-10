const express = require('express');
const router = express.Router();
const chatbot = require('./chatbotController');
const authMiddleware = require('../../middleware/authMiddleware');

// Public: get active FAQs and submit messages
router.get('/faqs', chatbot.getFaqs);
router.post('/messages', chatbot.submitMessage);

// Patient: get own messages and unread replies
router.get('/messages/patient/:patient_id', authMiddleware([]), chatbot.getPatientMessages);
router.get('/messages/patient/:patient_id/unread', authMiddleware([]), chatbot.getPatientUnreadReplies);

// Admin/Receptionist: manage FAQs and inbox
router.get('/faqs/all', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR', 'RECEPTIONIST']), chatbot.getAllFaqs);
router.post('/faqs', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR', 'RECEPTIONIST']), chatbot.createFaq);
router.put('/faqs/:id', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR', 'RECEPTIONIST']), chatbot.updateFaq);
router.delete('/faqs/:id', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR', 'RECEPTIONIST']), chatbot.deleteFaq);

router.get('/messages', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR', 'RECEPTIONIST']), chatbot.getMessages);
router.get('/messages/pending-count', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR', 'RECEPTIONIST']), chatbot.getPendingCount);
router.put('/messages/:id/reply', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR', 'RECEPTIONIST']), chatbot.replyMessage);

module.exports = router;
