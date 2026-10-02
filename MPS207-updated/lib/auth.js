function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/admin/login');
}

function checkCredentials(username, password) {
  const validUser = process.env.ADMIN_USERNAME || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'change-this-password';
  return username === validUser && password === validPass;
}

module.exports = { requireAdmin, checkCredentials };
