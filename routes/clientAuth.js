import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';

const router = express.Router();
function validatePin(pin) { return /^\d{6}$/.test(pin); }
function validateGhanaPhone(phone) { return /^0\d{9}$/.test(phone); }

router.post('/register', async (req, res) => {
  const { phone_number, pin, full_name } = req.body;
  if (!phone_number || !pin || !full_name?.trim()) return res.status(400).json({ error: 'phone_number, pin, and full_name are required' });
  if (!validateGhanaPhone(phone_number)) return res.status(400).json({ error: 'Phone number must be 10 digits starting with 0' });
  if (!validatePin(pin)) return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
  const existing = db.prepare('SELECT id FROM clients WHERE phone_number = ?').get(phone_number);
  if (existing) return res.status(409).json({ error: 'This phone number is already registered' });
  const id = uuidv4();
  const pinHash = await bcrypt.hash(pin, 10);
  db.prepare('INSERT INTO clients (id, phone_number, pin_hash, full_name) VALUES (?, ?, ?, ?)').run(id, phone_number, pinHash, full_name.trim());
  res.json({ client_id: id, phone_number, full_name: full_name.trim() });
});

router.post('/login', async (req, res) => {
  const { phone_number, pin } = req.body;
  if (!phone_number || !pin) return res.status(400).json({ error: 'phone_number and pin are required' });
  const client = db.prepare('SELECT * FROM clients WHERE phone_number = ?').get(phone_number);
  if (!client || !(await bcrypt.compare(pin, client.pin_hash))) return res.status(401).json({ error: 'Invalid phone number or PIN' });
  res.json({ client_id: client.id, phone_number: client.phone_number, full_name: client.full_name });
});

router.post('/reset-pin', async (req, res) => {
  const { phone_number, full_name, pin } = req.body;
  if (!phone_number || !full_name?.trim() || !validatePin(pin)) return res.status(400).json({ error: 'phone_number, full_name, and a valid 6-digit pin are required' });
  const client = db.prepare('SELECT * FROM clients WHERE phone_number = ? AND full_name = ?').get(phone_number, full_name.trim());
  if (!client) return res.status(401).json({ error: 'Phone number and name do not match our records' });
  const pinHash = await bcrypt.hash(pin, 10);
  db.prepare('UPDATE clients SET pin_hash = ? WHERE id = ?').run(pinHash, client.id);
  res.json({ success: true, message: 'PIN reset successfully' });
});

router.post('/change-pin', async (req, res) => {
  const { phone_number, old_pin, new_pin } = req.body;
  if (!phone_number || !old_pin || !validatePin(new_pin)) return res.status(400).json({ error: 'phone_number, old_pin, and a valid 6-digit new_pin are required' });
  const client = db.prepare('SELECT * FROM clients WHERE phone_number = ?').get(phone_number);
  if (!client || !(await bcrypt.compare(old_pin, client.pin_hash))) return res.status(401).json({ error: 'Current PIN is incorrect' });
  const pinHash = await bcrypt.hash(new_pin, 10);
  db.prepare('UPDATE clients SET pin_hash = ? WHERE id = ?').run(pinHash, client.id);
  res.json({ success: true, message: 'PIN changed successfully' });
});

export default router;
