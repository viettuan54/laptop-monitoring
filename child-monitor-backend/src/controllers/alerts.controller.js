exports.getAlerts = async (req, res) => {
  const { device_id, is_read } = req.query;
  let { limit, offset } = req.query;

  // Pagination: default 50, max 200
  limit = Math.min(parseInt(limit) || 50, 200);
  offset = Math.max(parseInt(offset) || 0, 0);

  try {
    let queryText = 'SELECT alert_id, device_id, alert_type, message, is_read, created_at FROM alerts';
    const queryParams = [];
    const conditions = [];

    // Nhờ RLS, các điều kiện dưới đây sẽ tự động lọc an toàn theo quyền sở hữu của phụ huynh
    if (device_id) {
      queryParams.push(device_id);
      conditions.push(`device_id = $${queryParams.length}`);
    }

    if (is_read !== undefined) {
      queryParams.push(is_read === 'true');
      conditions.push(`is_read = $${queryParams.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY created_at DESC';

    queryParams.push(limit);
    queryText += ` LIMIT $${queryParams.length}`;
    queryParams.push(offset);
    queryText += ` OFFSET $${queryParams.length}`;

    const result = await req.db.query(queryText, queryParams);
    res.json({ data: result.rows, limit, offset, count: result.rows.length });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.markAsRead = async (req, res) => {
  const { id } = req.params;

  try {
    // Nhờ RLS, nếu phụ huynh không sở hữu thiết bị liên kết với cảnh báo này, câu lệnh UPDATE sẽ trả về 0 dòng
    const result = await req.db.query(
      'UPDATE alerts SET is_read = TRUE WHERE alert_id = $1 RETURNING alert_id, device_id, alert_type, message, is_read, created_at',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Alert not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Mark alert as read error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
