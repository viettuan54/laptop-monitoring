/**
 * Dùng sau middleware auth: requireRole('admin'), requireRole('admin', 'parent')...
 */
module.exports = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.currentUser?.role || !allowedRoles.includes(req.currentUser.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};