import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { router as apiRouter } from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (_req, res) => {
  res.json({ ok: true, name: 'server', version: '1.0.0' });
});

app.use('/api', apiRouter);

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});
