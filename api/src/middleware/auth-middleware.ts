import { Response, NextFunction } from 'express';

const checkAuthAndRole = (req: import('express').Request, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'owner')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next(); // 如果验证通过，继续执行下一个中间件或路由处理程序
  return null;
};

export default checkAuthAndRole;
