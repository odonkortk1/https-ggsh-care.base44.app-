import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { requireStaff } from './middleware/auth.js';

const router = express.Router();
const rowToOrder = row => ({ ...row, items: JSON.parse(row.items) });

router.post('/', (req, res) => {
  const { customer_name, items, pickup_note, payment_method, client_phone } = req.body;
  if (!customer_name || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'customer_name and items are required' });
  const total = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  if (!(total > 0)) return res.status(400).json({ error: 'Total must be greater than zero' });
  const id = uuidv4();
  db.prepare(`INSERT INTO orders (id,customer_name,items,total,status,pickup_note,payment_method,client_phone) VALUES (?,?,?,?,'pending',?,?,?)`)
    .run(id, customer_name, JSON.stringify(items), total, pickup_note || '', payment_method || 'cash', client_phone || '');
  res.status(201).json(rowToOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(id)));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Order not found' });
  res.json(rowToOrder(row));
});

router.get('/', (req, res) => {
  const { client_phone, active_only } = req.query;
  if (client_phone) return res.json(db.prepare('SELECT * FROM orders WHERE client_phone=? ORDER BY created_at DESC LIMIT 100').all(client_phone).map(rowToOrder));
  return requireStaff(req, res, () => {
    const sql = active_only === 'true' ? "SELECT * FROM orders WHERE status!='completed' ORDER BY created_at DESC LIMIT 100" : 'SELECT * FROM orders ORDER BY created_at DESC LIMIT 500';
    res.json(db.prepare(sql).all().map(rowToOrder));
  });
});

router.patch('/:id/status', requireStaff, (req, res) => {
  const valid = ['pending','preparing','ready','completed'];
  if (!valid.includes(req.body.status)) return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  const result = db.prepare('UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.body.status, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Order not found' });
  res.json(rowToOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id)));
});

router.delete('/:id', requireStaff, (req, res) => {
  if (req.staff.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const result = db.prepare('DELETE FROM orders WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Order not found' });
  res.json({ success: true });
});

export default router;
