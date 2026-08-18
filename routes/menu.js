import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { requireStaff } from './middleware/auth.js';

const router = express.Router();
const rowToItem = (row) => ({ ...row, is_available: !!row.is_available, is_special: !!row.is_special });

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM menu_items ORDER BY category, name').all();
  res.json(rows.map(rowToItem));
});

router.post('/', requireStaff, (req, res) => {
  const { name, description, price, category, image_url, is_available, is_special, calories, prep_time_minutes } = req.body;
  if (!name || price === undefined || !category) return res.status(400).json({ error: 'name, price, and category are required' });
  const id = uuidv4();
  db.prepare(`INSERT INTO menu_items (id,name,description,price,category,image_url,is_available,is_special,calories,prep_time_minutes) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, name, description || null, Number(price), category, image_url || null, is_available === undefined ? 1 : is_available ? 1 : 0, is_special ? 1 : 0, calories || null, prep_time_minutes || null);
  res.status(201).json(rowToItem(db.prepare('SELECT * FROM menu_items WHERE id=?').get(id)));
});

router.put('/:id', requireStaff, (req, res) => {
  const existing = db.prepare('SELECT * FROM menu_items WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });
  const fields = ['name','description','price','category','image_url','is_available','is_special','calories','prep_time_minutes'];
  const updates = {};
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = ['is_available','is_special'].includes(f) ? (req.body[f] ? 1 : 0) : req.body[f];
  const keys = Object.keys(updates);
  if (keys.length) db.prepare(`UPDATE menu_items SET ${keys.map(k => `${k}=@${k}`).join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ ...updates, id: req.params.id });
  res.json(rowToItem(db.prepare('SELECT * FROM menu_items WHERE id=?').get(req.params.id)));
});

router.delete('/:id', requireStaff, (req, res) => {
  const result = db.prepare('DELETE FROM menu_items WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Item not found' });
  res.json({ success: true });
});

export default router;
