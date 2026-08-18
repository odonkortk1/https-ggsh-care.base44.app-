import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export function signStaffToken(staff) { return jwt.sign({ staff_id: staff.id, email: staff.email, role: staff.role }, JWT_SECRET, { expiresIn: '12h' }); }
export function requireStaff(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try { req.staff = jwt.verify(header.slice(7), JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}
export function requireAdmin(req, res, next) {
  requireStaff(req, res, () => {
    if (req.staff.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}
