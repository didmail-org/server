import { Router } from 'express';
import { Op } from 'sequelize';
import { getDatabaseSize, Mail } from '../../../storage/database';
import { destroyMailWithAttachments } from '../libs/mail-lifecycle';

const router = Router();

router.get('/mails', (req, res) => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10;
  const { search } = req.query;

  try {
    let condition: any = {};
    if (search) {
      condition = { [Op.or]: [{ sender: search }, { envelope: search }, { hash: search }, { assetTx: search }] };
    }

    Mail.findAndCountAll({
      where: condition,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      attributes: { exclude: ['content'] },
    }).then(({ count, rows }) => {
      return res.json({
        total: count,
        page,
        totalPages: Math.ceil(count / pageSize),
        mails: rows,
      });
    });
  } catch (error) {
    console.error('Error fetching mails:', error);
    return res.status(500).json({ message: 'Failed to fetch mails' });
  }
  return null;
});

router.delete('/mails/delete/:id', (req, res) => {
  const { id } = req.params;
  destroyMailWithAttachments(parseInt(id, 10)).then((result) => {
    if (result === 0) {
      return res.status(404).json({ message: 'Mail not found' });
    }
    return res.json({ message: 'Mail deleted successfully' });
  });
});

router.get('/size', async (_req, res) => {
  const size = await getDatabaseSize();
  return res.json({ size });
});

export default router;
