import { Hono } from 'hono';
import { helpLatestPosts } from '../core/help';

export const scheduler = new Hono();

scheduler.post('/hourly-help', async (c) => {
  try {
    const result = await helpLatestPosts(8);
    console.log('hourly-help', result.detail);
    return c.json({ status: 'ok', ...result }, 200);
  } catch (error) {
    console.error('hourly-help failed', error);
    return c.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'unknown',
      },
      500
    );
  }
});
