module.exports = function adminAuth(req, res, next) {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    return next();
  }

  // Also check headers for subsequent requests
  const headerUser = req.headers['x-admin-user'];
  const headerPass = req.headers['x-admin-pass'];

  if (
    headerUser === process.env.ADMIN_USER &&
    headerPass === process.env.ADMIN_PASS
  ) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
};
