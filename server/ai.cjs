#!/usr/bin/env node
const { GoogleGenAI } = require('@google/genai');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

module.exports = function initAiRoutes(app) {
  const apiKey = process.env.API_KEY || '';
  const AUTH_TOKEN = String(process.env.AI_AUTH_TOKEN || '').trim();
  const RATE_LIMIT = parseInt(process.env.AI_RATE_LIMIT || '30', 10); // requests per window
  const RATE_WINDOW = parseInt(process.env.AI_RATE_WINDOW_SECONDS || '60', 10) * 1000; // window in ms

  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  const aiRateLimit = rateLimit({
    windowMs: RATE_WINDOW,
    limit: RATE_LIMIT,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Rate limit exceeded' },
  });

  function checkAiAuth(req, res) {
    // Accept token from `x-ai-token` header or Authorization: Bearer <token>
    const authorizationMatch = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    const headerToken = req.headers['x-ai-token'] || authorizationMatch?.[1];
    const token = headerToken ? String(headerToken) : null;

    if (!AUTH_TOKEN) {
      res.status(503).json({ success: false, message: 'AI authentication is not configured' });
      return false;
    }

    const supplied = Buffer.from(token || '', 'utf8');
    const expected = Buffer.from(AUTH_TOKEN, 'utf8');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      res.status(401).json({ success: false, message: 'Unauthorized (AI token required)' });
      return false;
    }

    return true;
  }

  function aiAuthGuard(req, res, next) {
    if (!checkAiAuth(req, res)) return;
    next();
  }

  app.post('/api/ai/generate', aiRateLimit, aiAuthGuard, async (req, res) => {
    try {
      const { topic, context } = req.body || {};
      if (!ai)
        return res.status(503).json({ success: false, message: 'AI backend not configured' });
      const model = 'gemini-2.5-flash';
      const prompt = `You are a professional blog writing assistant. Topic: ${topic} Additional Context: ${context || ''} Please write an engaging paragraph or article outline in English. Use simple HTML formatting (p, strong, ul, li) for structure.`;
      const response = await ai.models.generateContent({ model, contents: prompt });
      return res.json({ success: true, text: response?.text || '' });
    } catch (err) {
      console.error('AI generate error', err);
      return res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });

  app.post('/api/ai/check', aiRateLimit, aiAuthGuard, async (req, res) => {
    try {
      const { text } = req.body || {};
      if (!ai)
        return res.status(503).json({ success: false, message: 'AI backend not configured' });
      const prompt = `Check the grammar of the following text and provide only the corrected version without additional explanation. Maintain existing HTML format if present:\n\n${text}`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return res.json({ success: true, text: response?.text || '' });
    } catch (err) {
      console.error('AI check error', err);
      return res.status(500).json({ success: false, message: err?.message || String(err) });
    }
  });
};
